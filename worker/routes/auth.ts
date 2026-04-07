import { Hono } from 'hono'
import { hashPassword, verifyPassword, generateToken, generateId } from '../lib/crypto'
import { signJwt } from '../lib/jwt'
import {
  sendEmail,
  verificationEmail,
  passwordResetEmail,
} from '../lib/email'
import type { AppContext } from '../types'

const auth = new Hono<AppContext>()

// ─── POST /register ───────────────────────────────────────────────────────────

auth.post('/register', async (c) => {
  try {
    const body = await c.req.json<{
      name?: string
      email?: string
      password?: string
      city?: string
      birth_date?: string
      whatsapp?: string
    }>()

    const { name, email, password, city, birth_date, whatsapp } = body

    if (!name || !email || !password || !city) {
      return c.json({ error: 'Campos obrigatórios: name, email, password, city' }, 400)
    }

    if (password.length < 6) {
      return c.json({ error: 'A senha deve ter pelo menos 6 caracteres' }, 400)
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return c.json({ error: 'E-mail inválido' }, 400)
    }

    // Check duplicate
    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(email.toLowerCase())
      .first<{ id: string }>()

    if (existing) {
      return c.json({ error: 'Este e-mail já está cadastrado' }, 409)
    }

    const id = generateId()
    const passwordHash = await hashPassword(password)
    const isAdmin = email.toLowerCase() === c.env.ADMIN_EMAIL.toLowerCase() ? 1 : 0
    const now = Math.floor(Date.now() / 1000)

    await c.env.DB.prepare(
      `INSERT INTO users (id, name, email, password_hash, city, birth_date, whatsapp, email_verified, is_admin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    )
      .bind(id, name.trim(), email.toLowerCase(), passwordHash, city.trim(), birth_date ?? null, whatsapp ?? null, isAdmin, now, now)
      .run()

    // Create verification token (24h)
    const tokenId = generateId()
    const token = generateToken()
    const expiresAt = now + 60 * 60 * 24

    await c.env.DB.prepare(
      `INSERT INTO auth_tokens (id, user_id, token, type, expires_at, created_at)
       VALUES (?, ?, ?, 'email_verify', ?, ?)`,
    )
      .bind(tokenId, id, token, expiresAt, now)
      .run()

    // Send verification email
    const verifyLink = `${c.env.FRONTEND_URL}/auth/verify-email?token=${token}`
    await sendEmail(
      {
        to: email.toLowerCase(),
        subject: 'Verifique seu e-mail — CoinHub',
        html: verificationEmail(name.trim(), verifyLink),
      },
      c.env.RESEND_API_KEY,
    )

    return c.json({ message: 'Cadastro realizado! Verifique seu e-mail para ativar sua conta.' }, 201)
  } catch (err) {
    console.error('[auth/register]', err)
    return c.json({ error: 'Erro ao criar conta' }, 500)
  }
})

// ─── POST /verify-email ───────────────────────────────────────────────────────

auth.post('/verify-email', async (c) => {
  try {
    const { token } = await c.req.json<{ token?: string }>()

    if (!token) {
      return c.json({ error: 'Token obrigatório' }, 400)
    }

    const now = Math.floor(Date.now() / 1000)

    const record = await c.env.DB.prepare(
      `SELECT id, user_id, expires_at FROM auth_tokens WHERE token = ? AND type = 'email_verify'`,
    )
      .bind(token)
      .first<{ id: string; user_id: string; expires_at: number }>()

    if (!record) {
      return c.json({ error: 'Token inválido' }, 400)
    }

    if (record.expires_at < now) {
      await c.env.DB.prepare('DELETE FROM auth_tokens WHERE id = ?').bind(record.id).run()
      return c.json({ error: 'Token expirado. Solicite um novo e-mail de verificação.' }, 400)
    }

    await c.env.DB.prepare('UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?')
      .bind(now, record.user_id)
      .run()

    await c.env.DB.prepare('DELETE FROM auth_tokens WHERE id = ?').bind(record.id).run()

    return c.json({ message: 'E-mail verificado com sucesso! Agora você pode fazer login.' })
  } catch (err) {
    console.error('[auth/verify-email]', err)
    return c.json({ error: 'Erro ao verificar e-mail' }, 500)
  }
})

// ─── POST /login ──────────────────────────────────────────────────────────────

auth.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json<{ email?: string; password?: string }>()

    if (!email || !password) {
      return c.json({ error: 'E-mail e senha são obrigatórios' }, 400)
    }

    const user = await c.env.DB.prepare(
      'SELECT id, name, email, password_hash, city, avatar_url, is_admin, email_verified FROM users WHERE email = ?',
    )
      .bind(email.toLowerCase())
      .first<{
        id: string
        name: string
        email: string
        password_hash: string | null
        city: string
        avatar_url: string | null
        is_admin: number
        email_verified: number
      }>()

    if (!user) {
      return c.json({ error: 'E-mail ou senha incorretos' }, 401)
    }

    if (!user.password_hash) {
      return c.json(
        { error: 'Esta conta foi criada via Google. Use o login com Google.' },
        401,
      )
    }

    const validPassword = await verifyPassword(password, user.password_hash)
    if (!validPassword) {
      return c.json({ error: 'E-mail ou senha incorretos' }, 401)
    }

    if (user.email_verified !== 1) {
      return c.json(
        {
          error: 'Conta não verificada. Por favor, verifique seu e-mail antes de fazer login.',
          code: 'EMAIL_NOT_VERIFIED',
        },
        403,
      )
    }

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      isAdmin: user.is_admin,
    }
    const jwtToken = await signJwt(tokenPayload, c.env.JWT_SECRET)

    return c.json({
      token: jwtToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        city: user.city,
        avatar_url: user.avatar_url,
        is_admin: user.is_admin,
      },
    })
  } catch (err) {
    console.error('[auth/login]', err)
    return c.json({ error: 'Erro ao fazer login' }, 500)
  }
})

// ─── POST /forgot-password ────────────────────────────────────────────────────

auth.post('/forgot-password', async (c) => {
  try {
    const { email } = await c.req.json<{ email?: string }>()

    if (!email) {
      return c.json({ error: 'E-mail obrigatório' }, 400)
    }

    const successMsg = { message: 'Se o e-mail existir em nossa base, você receberá as instruções em breve.' }

    const user = await c.env.DB.prepare('SELECT id, name, email FROM users WHERE email = ?')
      .bind(email.toLowerCase())
      .first<{ id: string; name: string; email: string }>()

    if (!user) {
      // Don't leak whether the email exists
      return c.json(successMsg)
    }

    const now = Math.floor(Date.now() / 1000)
    const tokenId = generateId()
    const token = generateToken()
    const expiresAt = now + 60 * 60 // 1 hour

    // Remove any existing reset tokens for this user
    await c.env.DB.prepare(`DELETE FROM auth_tokens WHERE user_id = ? AND type = 'password_reset'`)
      .bind(user.id)
      .run()

    await c.env.DB.prepare(
      `INSERT INTO auth_tokens (id, user_id, token, type, expires_at, created_at)
       VALUES (?, ?, ?, 'password_reset', ?, ?)`,
    )
      .bind(tokenId, user.id, token, expiresAt, now)
      .run()

    const resetLink = `${c.env.FRONTEND_URL}/auth/reset-password?token=${token}`
    await sendEmail(
      {
        to: user.email,
        subject: 'Redefinição de senha — CoinHub',
        html: passwordResetEmail(user.name, resetLink),
      },
      c.env.RESEND_API_KEY,
    )

    return c.json(successMsg)
  } catch (err) {
    console.error('[auth/forgot-password]', err)
    return c.json({ error: 'Erro ao processar solicitação' }, 500)
  }
})

// ─── POST /reset-password ─────────────────────────────────────────────────────

auth.post('/reset-password', async (c) => {
  try {
    const { token, password } = await c.req.json<{ token?: string; password?: string }>()

    if (!token || !password) {
      return c.json({ error: 'Token e nova senha são obrigatórios' }, 400)
    }

    if (password.length < 6) {
      return c.json({ error: 'A senha deve ter pelo menos 6 caracteres' }, 400)
    }

    const now = Math.floor(Date.now() / 1000)

    const record = await c.env.DB.prepare(
      `SELECT id, user_id, expires_at FROM auth_tokens WHERE token = ? AND type = 'password_reset'`,
    )
      .bind(token)
      .first<{ id: string; user_id: string; expires_at: number }>()

    if (!record) {
      return c.json({ error: 'Token inválido' }, 400)
    }

    if (record.expires_at < now) {
      await c.env.DB.prepare('DELETE FROM auth_tokens WHERE id = ?').bind(record.id).run()
      return c.json({ error: 'Token expirado. Solicite um novo link de redefinição.' }, 400)
    }

    const newPasswordHash = await hashPassword(password)

    await c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .bind(newPasswordHash, now, record.user_id)
      .run()

    await c.env.DB.prepare('DELETE FROM auth_tokens WHERE id = ?').bind(record.id).run()

    return c.json({ message: 'Senha atualizada com sucesso! Você já pode fazer login.' })
  } catch (err) {
    console.error('[auth/reset-password]', err)
    return c.json({ error: 'Erro ao redefinir senha' }, 500)
  }
})

// ─── GET /google ──────────────────────────────────────────────────────────────

auth.get('/google', (c) => {
  const state = generateToken()
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: c.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  })

  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
})

// ─── GET /google/callback ─────────────────────────────────────────────────────

auth.get('/google/callback', async (c) => {
  try {
    const code = c.req.query('code')
    const error = c.req.query('error')

    if (error || !code) {
      return c.redirect(`${c.env.FRONTEND_URL}/auth/login?error=google_denied`)
    }

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: c.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      console.error('[auth/google/callback] token exchange failed:', await tokenRes.text())
      return c.redirect(`${c.env.FRONTEND_URL}/auth/login?error=google_token`)
    }

    const tokenData = await tokenRes.json<{ access_token: string }>()

    // Get user info from Google
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (!userInfoRes.ok) {
      return c.redirect(`${c.env.FRONTEND_URL}/auth/login?error=google_userinfo`)
    }

    const googleUser = await userInfoRes.json<{
      sub: string
      email: string
      name: string
      picture?: string
      email_verified?: boolean
    }>()

    const now = Math.floor(Date.now() / 1000)

    // Try to find existing user by google_id first, then by email
    let user = await c.env.DB.prepare(
      'SELECT id, name, email, city, avatar_url, is_admin FROM users WHERE google_id = ?',
    )
      .bind(googleUser.sub)
      .first<{ id: string; name: string; email: string; city: string; avatar_url: string | null; is_admin: number }>()

    if (!user) {
      user = await c.env.DB.prepare(
        'SELECT id, name, email, city, avatar_url, is_admin FROM users WHERE email = ?',
      )
        .bind(googleUser.email.toLowerCase())
        .first<{ id: string; name: string; email: string; city: string; avatar_url: string | null; is_admin: number }>()

      if (user) {
        // Link Google account to existing user
        await c.env.DB.prepare('UPDATE users SET google_id = ?, email_verified = 1, updated_at = ? WHERE id = ?')
          .bind(googleUser.sub, now, user.id)
          .run()
      }
    }

    if (!user) {
      // Create new user from Google
      const newId = generateId()
      const isAdmin = googleUser.email.toLowerCase() === c.env.ADMIN_EMAIL.toLowerCase() ? 1 : 0

      await c.env.DB.prepare(
        `INSERT INTO users (id, name, email, google_id, avatar_url, email_verified, is_admin, city, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, '', ?, ?)`,
      )
        .bind(newId, googleUser.name, googleUser.email.toLowerCase(), googleUser.sub, googleUser.picture ?? null, isAdmin, now, now)
        .run()

      user = {
        id: newId,
        name: googleUser.name,
        email: googleUser.email.toLowerCase(),
        city: '',
        avatar_url: googleUser.picture ?? null,
        is_admin: isAdmin,
      }
    }

    const jwt = await signJwt(
      { userId: user.id, email: user.email, isAdmin: user.is_admin },
      c.env.JWT_SECRET,
    )

    return c.redirect(`${c.env.FRONTEND_URL}/auth/callback?token=${jwt}`)
  } catch (err) {
    console.error('[auth/google/callback]', err)
    return c.redirect(`${c.env.FRONTEND_URL}/auth/login?error=server_error`)
  }
})

// ─── POST /resend-verification ────────────────────────────────────────────────

auth.post('/resend-verification', async (c) => {
  try {
    const { email } = await c.req.json<{ email?: string }>()

    if (!email) {
      return c.json({ error: 'E-mail obrigatório' }, 400)
    }

    const user = await c.env.DB.prepare(
      'SELECT id, name, email, email_verified FROM users WHERE email = ?',
    )
      .bind(email.toLowerCase())
      .first<{ id: string; name: string; email: string; email_verified: number }>()

    if (!user) {
      return c.json({ message: 'Se o e-mail existir, um novo link foi enviado.' })
    }

    if (user.email_verified === 1) {
      return c.json({ error: 'Este e-mail já foi verificado. Você pode fazer login normalmente.' }, 400)
    }

    const now = Math.floor(Date.now() / 1000)

    // Remove existing verify tokens
    await c.env.DB.prepare(`DELETE FROM auth_tokens WHERE user_id = ? AND type = 'email_verify'`)
      .bind(user.id)
      .run()

    const tokenId = generateId()
    const token = generateToken()
    const expiresAt = now + 60 * 60 * 24

    await c.env.DB.prepare(
      `INSERT INTO auth_tokens (id, user_id, token, type, expires_at, created_at)
       VALUES (?, ?, ?, 'email_verify', ?, ?)`,
    )
      .bind(tokenId, user.id, token, expiresAt, now)
      .run()

    const verifyLink = `${c.env.FRONTEND_URL}/auth/verify-email?token=${token}`
    await sendEmail(
      {
        to: user.email,
        subject: 'Verifique seu e-mail — CoinHub',
        html: verificationEmail(user.name, verifyLink),
      },
      c.env.RESEND_API_KEY,
    )

    return c.json({ message: 'Um novo e-mail de verificação foi enviado. Verifique sua caixa de entrada.' })
  } catch (err) {
    console.error('[auth/resend-verification]', err)
    return c.json({ error: 'Erro ao reenviar verificação' }, 500)
  }
})

export { auth as authRoutes }
