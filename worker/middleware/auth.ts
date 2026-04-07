import type { Context, Next } from 'hono'
import { verifyJwt } from '../lib/jwt'
import type { AppContext, DbUser } from '../types'

export type UserPayload = {
  userId: string
  email: string
  isAdmin: number
}

/**
 * Require a valid JWT Bearer token.
 * Injects the verified user into c.var via c.set('user', ...).
 * Returns 401 if the token is missing or invalid.
 */
export const authMiddleware = async (
  c: Context<AppContext>,
  next: Next,
): Promise<Response | void> => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Não autenticado' }, 401)
  }

  const token = authHeader.slice(7)
  const payload = await verifyJwt(token, c.env.JWT_SECRET)

  if (!payload || typeof payload.userId !== 'string') {
    return c.json({ error: 'Token inválido ou expirado' }, 401)
  }

  // Verify user still exists in DB
  const user = await c.env.DB.prepare(
    'SELECT id, name, email, city, avatar_url, is_admin, email_verified FROM users WHERE id = ?',
  )
    .bind(payload.userId)
    .first<DbUser>()

  if (!user) {
    return c.json({ error: 'Usuário não encontrado' }, 401)
  }

  c.set('user', user)
  await next()
}

/**
 * Optionally authenticate. Does NOT return 401 on missing/invalid token.
 * c.get('user') will be null if not authenticated.
 */
export const optionalAuthMiddleware = async (
  c: Context<AppContext>,
  next: Next,
): Promise<Response | void> => {
  const authHeader = c.req.header('Authorization')

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const payload = await verifyJwt(token, c.env.JWT_SECRET)

    if (payload && typeof payload.userId === 'string') {
      const user = await c.env.DB.prepare(
        'SELECT id, name, email, city, avatar_url, is_admin, email_verified FROM users WHERE id = ?',
      )
        .bind(payload.userId)
        .first<DbUser>()

      if (user) {
        c.set('user', user)
      } else {
        c.set('user', null)
      }
    } else {
      c.set('user', null)
    }
  } else {
    c.set('user', null)
  }

  await next()
}

/**
 * Require the authenticated user to have is_admin === 1.
 * Must be used AFTER authMiddleware.
 */
export const adminMiddleware = async (
  c: Context<AppContext>,
  next: Next,
): Promise<Response | void> => {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Não autenticado' }, 401)
  }

  if (user.is_admin !== 1) {
    return c.json({ error: 'Acesso negado. Área restrita a administradores.' }, 403)
  }

  await next()
}
