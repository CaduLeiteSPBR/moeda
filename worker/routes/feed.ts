import { Hono } from 'hono'
import { optionalAuthMiddleware } from '../middleware/auth'
import type { AppContext, DbUser } from '../types'

const feed = new Hono<AppContext>()

// ─── GET / ────────────────────────────────────────────────────────────────────

feed.get('/', optionalAuthMiddleware, async (c) => {
  try {
    const authUser = c.get('user') as DbUser | null
    const type = c.req.query('type') ?? 'all' // 'all' | 'following'
    const page = Math.max(1, parseInt(c.req.query('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? '20')))
    const offset = (page - 1) * limit

    if (type === 'following') {
      if (!authUser) {
        return c.json({ error: 'Autenticação necessária para o feed de seguidores' }, 401)
      }

      const [rows, countRow] = await Promise.all([
        c.env.DB.prepare(
          `SELECT i.id, i.user_id, i.type, i.country, i.year, i.denomination, i.currency,
                  i.quantity, i.available_for_trade, i.commemorative_edition, i.description,
                  i.front_image_url, i.back_image_url,
                  datetime(i.created_at, 'unixepoch') as created_at,
                  datetime(i.updated_at, 'unixepoch') as updated_at,
                  u.name as owner_name, u.city as owner_city, u.avatar_url as owner_avatar_url
           FROM items i
           JOIN users u ON u.id = i.user_id
           JOIN follows f ON f.following_id = i.user_id
           WHERE f.follower_id = ?
           ORDER BY i.created_at DESC
           LIMIT ? OFFSET ?`,
        )
          .bind(authUser.id, limit, offset)
          .all(),
        c.env.DB.prepare(
          `SELECT COUNT(*) as total
           FROM items i
           JOIN follows f ON f.following_id = i.user_id
           WHERE f.follower_id = ?`,
        )
          .bind(authUser.id)
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
    }

    // type === 'all' — public feed
    const [rows, countRow] = await Promise.all([
      c.env.DB.prepare(
        `SELECT i.id, i.user_id, i.type, i.country, i.year, i.denomination, i.currency,
                i.quantity, i.available_for_trade, i.commemorative_edition, i.description,
                i.front_image_url, i.back_image_url,
                datetime(i.created_at, 'unixepoch') as created_at,
                datetime(i.updated_at, 'unixepoch') as updated_at,
                u.name as owner_name, u.city as owner_city, u.avatar_url as owner_avatar_url
         FROM items i
         JOIN users u ON u.id = i.user_id
         ORDER BY i.created_at DESC
         LIMIT ? OFFSET ?`,
      )
        .bind(limit, offset)
        .all(),
      c.env.DB.prepare('SELECT COUNT(*) as total FROM items').first<{ total: number }>(),
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
    console.error('[feed/ GET]', err)
    return c.json({ error: 'Erro ao carregar feed' }, 500)
  }
})

export { feed as feedRoutes }
