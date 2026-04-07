import { Hono } from 'hono'
import { authMiddleware, adminMiddleware } from '../middleware/auth'
import { hashPassword } from '../lib/crypto'
import type { AppContext } from '../types'

const admin = new Hono<AppContext>()

// Apply auth + admin middleware to all routes in this router
admin.use('*', authMiddleware, adminMiddleware)

// ─── GET /users ───────────────────────────────────────────────────────────────

admin.get('/users', async (c) => {
  try {
    const page = Math.max(1, parseInt(c.req.query('page') ?? '1'))
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query('limit') ?? '50')))
    const offset = (page - 1) * limit
    const q = c.req.query('q')

    const conditions: string[] = []
    const params: unknown[] = []

    if (q) {
      conditions.push('(u.name LIKE ? OR u.email LIKE ? OR u.city LIKE ?)')
      const pattern = `%${q}%`
      params.push(pattern, pattern, pattern)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const dataParams = [...params, limit, offset]
    const countParams = [...params]

    const [rows, countRow] = await Promise.all([
      c.env.DB.prepare(
        `SELECT u.id, u.name, u.email, u.city, u.avatar_url, u.is_admin, u.email_verified,
                datetime(u.created_at, 'unixepoch') as created_at,
                COUNT(i.id) as item_count
         FROM users u
         LEFT JOIN items i ON i.user_id = u.id
         ${where}
         GROUP BY u.id
         ORDER BY u.created_at DESC
         LIMIT ? OFFSET ?`,
      )
        .bind(...dataParams)
        .all(),
      c.env.DB.prepare(`SELECT COUNT(*) as total FROM users u ${where}`)
        .bind(...countParams)
        .first<{ total: number }>(),
    ])

    const total = countRow?.total ?? 0

    return c.json({
      data: rows.results,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    console.error('[admin/users GET]', err)
    return c.json({ error: 'Erro ao listar usuários' }, 500)
  }
})

// ─── POST /users/:id/reset-password ──────────────────────────────────────────

admin.post('/users/:id/reset-password', async (c) => {
  try {
    const { id } = c.req.param()
    const { new_password } = await c.req.json<{ new_password?: string }>()

    if (!new_password) {
      return c.json({ error: 'new_password é obrigatório' }, 400)
    }

    if (new_password.length < 6) {
      return c.json({ error: 'A senha deve ter pelo menos 6 caracteres' }, 400)
    }

    const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first()
    if (!user) return c.json({ error: 'Usuário não encontrado' }, 404)

    const newHash = await hashPassword(new_password)
    const now = Math.floor(Date.now() / 1000)

    await c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .bind(newHash, now, id)
      .run()

    return c.json({ message: 'Senha redefinida com sucesso' })
  } catch (err) {
    console.error('[admin/users/:id/reset-password]', err)
    return c.json({ error: 'Erro ao redefinir senha' }, 500)
  }
})

// ─── GET /stats ───────────────────────────────────────────────────────────────

admin.get('/stats', async (c) => {
  try {
    const [userCount, itemCount, messageCount, interestCount] = await Promise.all([
      c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM items').first<{ count: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM messages').first<{ count: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM interests').first<{ count: number }>(),
    ])

    return c.json({
      users: userCount?.count ?? 0,
      items: itemCount?.count ?? 0,
      messages: messageCount?.count ?? 0,
      interests: interestCount?.count ?? 0,
    })
  } catch (err) {
    console.error('[admin/stats]', err)
    return c.json({ error: 'Erro ao buscar estatísticas' }, 500)
  }
})

// ─── DELETE /items/:id ────────────────────────────────────────────────────────

admin.delete('/items/:id', async (c) => {
  try {
    const { id } = c.req.param()

    const item = await c.env.DB.prepare('SELECT id FROM items WHERE id = ?').bind(id).first()
    if (!item) return c.json({ error: 'Item não encontrado' }, 404)

    await c.env.DB.prepare('DELETE FROM interests WHERE item_id = ?').bind(id).run()
    await c.env.DB.prepare('DELETE FROM messages WHERE item_id = ?').bind(id).run()
    await c.env.DB.prepare('DELETE FROM items WHERE id = ?').bind(id).run()

    return c.json({ message: 'Item deletado com sucesso' })
  } catch (err) {
    console.error('[admin/items/:id DELETE]', err)
    return c.json({ error: 'Erro ao deletar item' }, 500)
  }
})

// ─── DELETE /users/:id ────────────────────────────────────────────────────────

admin.delete('/users/:id', async (c) => {
  try {
    const { id } = c.req.param()

    const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first()
    if (!user) return c.json({ error: 'Usuário não encontrado' }, 404)

    // Clean up all user data
    await c.env.DB.prepare('DELETE FROM auth_tokens WHERE user_id = ?').bind(id).run()
    await c.env.DB.prepare('DELETE FROM interests WHERE user_id = ?').bind(id).run()
    await c.env.DB.prepare('DELETE FROM follows WHERE follower_id = ? OR following_id = ?').bind(id, id).run()
    await c.env.DB.prepare('DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?').bind(id, id).run()
    // Delete interests on user's items
    await c.env.DB.prepare(
      'DELETE FROM interests WHERE item_id IN (SELECT id FROM items WHERE user_id = ?)',
    )
      .bind(id)
      .run()
    await c.env.DB.prepare('DELETE FROM items WHERE user_id = ?').bind(id).run()
    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run()

    return c.json({ message: 'Usuário deletado com sucesso' })
  } catch (err) {
    console.error('[admin/users/:id DELETE]', err)
    return c.json({ error: 'Erro ao deletar usuário' }, 500)
  }
})

// ─── PUT /users/:id/toggle-admin ─────────────────────────────────────────────

admin.put('/users/:id/toggle-admin', async (c) => {
  try {
    const { id } = c.req.param()

    const user = await c.env.DB.prepare('SELECT id, is_admin FROM users WHERE id = ?')
      .bind(id)
      .first<{ id: string; is_admin: number }>()

    if (!user) return c.json({ error: 'Usuário não encontrado' }, 404)

    const newAdminStatus = user.is_admin === 1 ? 0 : 1
    const now = Math.floor(Date.now() / 1000)

    await c.env.DB.prepare('UPDATE users SET is_admin = ?, updated_at = ? WHERE id = ?')
      .bind(newAdminStatus, now, id)
      .run()

    return c.json({
      message: newAdminStatus === 1 ? 'Usuário promovido a administrador' : 'Privilégios de administrador removidos',
      is_admin: newAdminStatus,
    })
  } catch (err) {
    console.error('[admin/users/:id/toggle-admin]', err)
    return c.json({ error: 'Erro ao alterar permissões' }, 500)
  }
})

export { admin as adminRoutes }
