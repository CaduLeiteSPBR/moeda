import { Hono } from 'hono'
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth'
import { hashPassword, verifyPassword } from '../lib/crypto'
import type { AppContext, DbUser } from '../types'

const users = new Hono<AppContext>()

// ─── GET /me ──────────────────────────────────────────────────────────────────

users.get('/me', authMiddleware, async (c) => {
  try {
    const authUser = c.get('user') as DbUser

    const user = await c.env.DB.prepare(
      `SELECT id, name, email, city, birth_date, whatsapp, avatar_url, email_verified, is_admin,
              datetime(created_at, 'unixepoch') as created_at,
              datetime(updated_at, 'unixepoch') as updated_at
       FROM users WHERE id = ?`,
    )
      .bind(authUser.id)
      .first()

    if (!user) return c.json({ error: 'Usuário não encontrado' }, 404)

    return c.json({ user })
  } catch (err) {
    console.error('[users/me GET]', err)
    return c.json({ error: 'Erro ao buscar perfil' }, 500)
  }
})

// ─── PUT /me ──────────────────────────────────────────────────────────────────

users.put('/me', authMiddleware, async (c) => {
  try {
    const authUser = c.get('user') as DbUser
    const body = await c.req.json<{
      name?: string
      city?: string
      birth_date?: string
      whatsapp?: string
      avatar_url?: string
    }>()

    const now = Math.floor(Date.now() / 1000)

    const fields: string[] = []
    const values: unknown[] = []

    if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name.trim()) }
    if (body.city !== undefined) { fields.push('city = ?'); values.push(body.city.trim()) }
    if (body.birth_date !== undefined) { fields.push('birth_date = ?'); values.push(body.birth_date) }
    if (body.whatsapp !== undefined) { fields.push('whatsapp = ?'); values.push(body.whatsapp) }
    if (body.avatar_url !== undefined) { fields.push('avatar_url = ?'); values.push(body.avatar_url) }

    if (fields.length === 0) {
      return c.json({ error: 'Nenhum campo para atualizar' }, 400)
    }

    fields.push('updated_at = ?')
    values.push(now)
    values.push(authUser.id)

    await c.env.DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run()

    const updated = await c.env.DB.prepare(
      `SELECT id, name, email, city, birth_date, whatsapp, avatar_url, email_verified, is_admin,
              datetime(created_at, 'unixepoch') as created_at,
              datetime(updated_at, 'unixepoch') as updated_at
       FROM users WHERE id = ?`,
    )
      .bind(authUser.id)
      .first()

    return c.json({ user: updated })
  } catch (err) {
    console.error('[users/me PUT]', err)
    return c.json({ error: 'Erro ao atualizar perfil' }, 500)
  }
})

// ─── PUT /me/password ─────────────────────────────────────────────────────────

users.put('/me/password', authMiddleware, async (c) => {
  try {
    const authUser = c.get('user') as DbUser
    const { current_password, new_password } = await c.req.json<{
      current_password?: string
      new_password?: string
    }>()

    if (!current_password || !new_password) {
      return c.json({ error: 'current_password e new_password são obrigatórios' }, 400)
    }

    if (new_password.length < 6) {
      return c.json({ error: 'A nova senha deve ter pelo menos 6 caracteres' }, 400)
    }

    const user = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
      .bind(authUser.id)
      .first<{ password_hash: string | null }>()

    if (!user || !user.password_hash) {
      return c.json({ error: 'Esta conta não possui senha definida (criada via Google)' }, 400)
    }

    const valid = await verifyPassword(current_password, user.password_hash)
    if (!valid) {
      return c.json({ error: 'Senha atual incorreta' }, 400)
    }

    const newHash = await hashPassword(new_password)
    const now = Math.floor(Date.now() / 1000)

    await c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .bind(newHash, now, authUser.id)
      .run()

    return c.json({ message: 'Senha atualizada com sucesso' })
  } catch (err) {
    console.error('[users/me/password]', err)
    return c.json({ error: 'Erro ao atualizar senha' }, 500)
  }
})

// ─── GET /search ──────────────────────────────────────────────────────────────

users.get('/search', optionalAuthMiddleware, async (c) => {
  try {
    const q = c.req.query('q') ?? ''
    const page = Math.max(1, parseInt(c.req.query('page') ?? '1'))
    const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') ?? '20')))
    const offset = (page - 1) * limit

    if (q.length < 2) {
      return c.json({ error: 'A busca deve ter pelo menos 2 caracteres' }, 400)
    }

    const pattern = `%${q}%`

    const [rows, countRow] = await Promise.all([
      c.env.DB.prepare(
        `SELECT id, name, city, avatar_url, datetime(created_at, 'unixepoch') as created_at
         FROM users
         WHERE (name LIKE ? OR city LIKE ?)
         ORDER BY name ASC
         LIMIT ? OFFSET ?`,
      )
        .bind(pattern, pattern, limit, offset)
        .all(),
      c.env.DB.prepare(
        'SELECT COUNT(*) as total FROM users WHERE (name LIKE ? OR city LIKE ?)',
      )
        .bind(pattern, pattern)
        .first<{ total: number }>(),
    ])

    const total = countRow?.total ?? 0

    return c.json({
      data: rows.results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    console.error('[users/search]', err)
    return c.json({ error: 'Erro na busca' }, 500)
  }
})

// ─── GET /:id ─────────────────────────────────────────────────────────────────

users.get('/:id', optionalAuthMiddleware, async (c) => {
  try {
    const { id } = c.req.param()
    const authUser = c.get('user') as DbUser | null

    const user = await c.env.DB.prepare(
      `SELECT id, name, city, avatar_url, datetime(created_at, 'unixepoch') as created_at
       FROM users WHERE id = ?`,
    )
      .bind(id)
      .first<{ id: string; name: string; city: string; avatar_url: string | null; created_at: string }>()

    if (!user) return c.json({ error: 'Usuário não encontrado' }, 404)

    const [itemCount, followerCount, followingCount] = await Promise.all([
      c.env.DB.prepare('SELECT COUNT(*) as count FROM items WHERE user_id = ?').bind(id).first<{ count: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM follows WHERE following_id = ?').bind(id).first<{ count: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?').bind(id).first<{ count: number }>(),
    ])

    let is_following = false
    if (authUser && authUser.id !== id) {
      const followRecord = await c.env.DB.prepare(
        'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
      )
        .bind(authUser.id, id)
        .first()
      is_following = !!followRecord
    }

    return c.json({
      user: {
        ...user,
        item_count: itemCount?.count ?? 0,
        follower_count: followerCount?.count ?? 0,
        following_count: followingCount?.count ?? 0,
        is_following,
      },
    })
  } catch (err) {
    console.error('[users/:id GET]', err)
    return c.json({ error: 'Erro ao buscar usuário' }, 500)
  }
})

// ─── POST /:id/follow ─────────────────────────────────────────────────────────

users.post('/:id/follow', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param()
    const authUser = c.get('user') as DbUser

    if (authUser.id === id) {
      return c.json({ error: 'Você não pode seguir a si mesmo' }, 400)
    }

    const target = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first()
    if (!target) return c.json({ error: 'Usuário não encontrado' }, 404)

    const now = Math.floor(Date.now() / 1000)

    // Idempotent — ignore if already following
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)',
    )
      .bind(authUser.id, id, now)
      .run()

    return c.json({ message: 'Agora você está seguindo este usuário', following: true })
  } catch (err) {
    console.error('[users/:id/follow POST]', err)
    return c.json({ error: 'Erro ao seguir usuário' }, 500)
  }
})

// ─── DELETE /:id/follow ───────────────────────────────────────────────────────

users.delete('/:id/follow', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param()
    const authUser = c.get('user') as DbUser

    await c.env.DB.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?')
      .bind(authUser.id, id)
      .run()

    return c.json({ message: 'Você deixou de seguir este usuário', following: false })
  } catch (err) {
    console.error('[users/:id/follow DELETE]', err)
    return c.json({ error: 'Erro ao deixar de seguir' }, 500)
  }
})

// ─── GET /:id/followers ───────────────────────────────────────────────────────

users.get('/:id/followers', optionalAuthMiddleware, async (c) => {
  try {
    const { id } = c.req.param()
    const page = Math.max(1, parseInt(c.req.query('page') ?? '1'))
    const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') ?? '20')))
    const offset = (page - 1) * limit

    const [rows, countRow] = await Promise.all([
      c.env.DB.prepare(
        `SELECT u.id, u.name, u.city, u.avatar_url,
                datetime(f.created_at, 'unixepoch') as followed_at
         FROM follows f
         JOIN users u ON u.id = f.follower_id
         WHERE f.following_id = ?
         ORDER BY f.created_at DESC
         LIMIT ? OFFSET ?`,
      )
        .bind(id, limit, offset)
        .all(),
      c.env.DB.prepare('SELECT COUNT(*) as total FROM follows WHERE following_id = ?')
        .bind(id)
        .first<{ total: number }>(),
    ])

    const total = countRow?.total ?? 0

    return c.json({
      data: rows.results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    console.error('[users/:id/followers]', err)
    return c.json({ error: 'Erro ao listar seguidores' }, 500)
  }
})

// ─── GET /:id/following ───────────────────────────────────────────────────────

users.get('/:id/following', optionalAuthMiddleware, async (c) => {
  try {
    const { id } = c.req.param()
    const page = Math.max(1, parseInt(c.req.query('page') ?? '1'))
    const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') ?? '20')))
    const offset = (page - 1) * limit

    const [rows, countRow] = await Promise.all([
      c.env.DB.prepare(
        `SELECT u.id, u.name, u.city, u.avatar_url,
                datetime(f.created_at, 'unixepoch') as followed_at
         FROM follows f
         JOIN users u ON u.id = f.following_id
         WHERE f.follower_id = ?
         ORDER BY f.created_at DESC
         LIMIT ? OFFSET ?`,
      )
        .bind(id, limit, offset)
        .all(),
      c.env.DB.prepare('SELECT COUNT(*) as total FROM follows WHERE follower_id = ?')
        .bind(id)
        .first<{ total: number }>(),
    ])

    const total = countRow?.total ?? 0

    return c.json({
      data: rows.results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    console.error('[users/:id/following]', err)
    return c.json({ error: 'Erro ao listar seguindo' }, 500)
  }
})

export { users as usersRoutes }
