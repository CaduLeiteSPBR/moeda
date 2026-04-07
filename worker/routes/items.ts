import { Hono } from 'hono'
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth'
import { generateId } from '../lib/crypto'
import { sendEmail, interestEmail } from '../lib/email'
import type { AppContext, DbUser } from '../types'

const items = new Hono<AppContext>()

// ─── GET / ────────────────────────────────────────────────────────────────────

items.get('/', optionalAuthMiddleware, async (c) => {
  try {
    const user_id = c.req.query('user_id')
    const type = c.req.query('type')
    const country = c.req.query('country')
    const q = c.req.query('q')
    const available_for_trade = c.req.query('available_for_trade')
    const page = Math.max(1, parseInt(c.req.query('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? '20')))
    const offset = (page - 1) * limit

    const conditions: string[] = []
    const params: unknown[] = []

    if (user_id) { conditions.push('i.user_id = ?'); params.push(user_id) }
    if (type && (type === 'coin' || type === 'note')) { conditions.push('i.type = ?'); params.push(type) }
    if (country) { conditions.push('i.country LIKE ?'); params.push(`%${country}%`) }
    if (available_for_trade === '1' || available_for_trade === 'true') {
      conditions.push('i.available_for_trade = 1')
    }
    if (q) {
      conditions.push(`(
        i.country LIKE ? OR
        i.description LIKE ? OR
        i.commemorative_edition LIKE ? OR
        CAST(i.year AS TEXT) LIKE ? OR
        CAST(i.denomination AS TEXT) LIKE ?
      )`)
      const p = `%${q}%`
      params.push(p, p, p, p, p)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const countParams = [...params]
    const dataParams = [...params, limit, offset]

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
         ${where}
         ORDER BY i.created_at DESC
         LIMIT ? OFFSET ?`,
      )
        .bind(...dataParams)
        .all(),
      c.env.DB.prepare(`SELECT COUNT(*) as total FROM items i ${where}`)
        .bind(...countParams)
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
    console.error('[items/ GET]', err)
    return c.json({ error: 'Erro ao listar itens' }, 500)
  }
})

// ─── POST / ───────────────────────────────────────────────────────────────────

items.post('/', authMiddleware, async (c) => {
  try {
    const authUser = c.get('user') as DbUser
    const body = await c.req.json<{
      type?: string
      country?: string
      year?: number
      denomination?: number
      currency?: string
      quantity?: number
      available_for_trade?: boolean | number
      commemorative_edition?: string
      description?: string
      front_image_url?: string
      back_image_url?: string
    }>()

    if (!body.type || !body.country) {
      return c.json({ error: 'type e country são obrigatórios' }, 400)
    }

    if (body.type !== 'coin' && body.type !== 'note') {
      return c.json({ error: 'type deve ser "coin" ou "note"' }, 400)
    }

    if (body.quantity !== undefined && body.quantity < 1) {
      return c.json({ error: 'quantity deve ser pelo menos 1' }, 400)
    }

    const id = generateId()
    const now = Math.floor(Date.now() / 1000)
    const availableForTrade = body.available_for_trade ? 1 : 0

    await c.env.DB.prepare(
      `INSERT INTO items
         (id, user_id, type, country, year, denomination, currency, quantity,
          available_for_trade, commemorative_edition, description,
          front_image_url, back_image_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id, authUser.id, body.type, body.country.trim(),
        body.year ?? null, body.denomination ?? null, body.currency ?? null,
        body.quantity ?? 1, availableForTrade,
        body.commemorative_edition ?? null, body.description ?? null,
        body.front_image_url ?? null, body.back_image_url ?? null,
        now, now,
      )
      .run()

    const item = await c.env.DB.prepare(
      `SELECT *, datetime(created_at, 'unixepoch') as created_at, datetime(updated_at, 'unixepoch') as updated_at
       FROM items WHERE id = ?`,
    )
      .bind(id)
      .first()

    return c.json({ item }, 201)
  } catch (err) {
    console.error('[items/ POST]', err)
    return c.json({ error: 'Erro ao criar item' }, 500)
  }
})

// ─── GET /:id ─────────────────────────────────────────────────────────────────

items.get('/:id', optionalAuthMiddleware, async (c) => {
  try {
    const { id } = c.req.param()
    const authUser = c.get('user') as DbUser | null

    const item = await c.env.DB.prepare(
      `SELECT i.id, i.user_id, i.type, i.country, i.year, i.denomination, i.currency,
              i.quantity, i.available_for_trade, i.commemorative_edition, i.description,
              i.front_image_url, i.back_image_url,
              datetime(i.created_at, 'unixepoch') as created_at,
              datetime(i.updated_at, 'unixepoch') as updated_at,
              u.name as owner_name, u.city as owner_city, u.avatar_url as owner_avatar_url
       FROM items i
       JOIN users u ON u.id = i.user_id
       WHERE i.id = ?`,
    )
      .bind(id)
      .first<{
        id: string
        user_id: string
        type: string
        country: string
        year: number | null
        denomination: number | null
        currency: string | null
        quantity: number
        available_for_trade: number
        commemorative_edition: string | null
        description: string | null
        front_image_url: string | null
        back_image_url: string | null
        created_at: string
        updated_at: string
        owner_name: string
        owner_city: string
        owner_avatar_url: string | null
      }>()

    if (!item) return c.json({ error: 'Item não encontrado' }, 404)

    let is_owner = false
    let is_interested = false

    if (authUser) {
      is_owner = authUser.id === item.user_id
      const interestRecord = await c.env.DB.prepare(
        'SELECT 1 FROM interests WHERE user_id = ? AND item_id = ?',
      )
        .bind(authUser.id, id)
        .first()
      is_interested = !!interestRecord
    }

    return c.json({ item: { ...item, is_owner, is_interested } })
  } catch (err) {
    console.error('[items/:id GET]', err)
    return c.json({ error: 'Erro ao buscar item' }, 500)
  }
})

// ─── PUT /:id ─────────────────────────────────────────────────────────────────

items.put('/:id', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param()
    const authUser = c.get('user') as DbUser

    const existing = await c.env.DB.prepare('SELECT user_id FROM items WHERE id = ?')
      .bind(id)
      .first<{ user_id: string }>()

    if (!existing) return c.json({ error: 'Item não encontrado' }, 404)
    if (existing.user_id !== authUser.id && authUser.is_admin !== 1) {
      return c.json({ error: 'Sem permissão para editar este item' }, 403)
    }

    const body = await c.req.json<{
      type?: string
      country?: string
      year?: number | null
      denomination?: number | null
      currency?: string | null
      quantity?: number
      available_for_trade?: boolean | number
      commemorative_edition?: string | null
      description?: string | null
      front_image_url?: string | null
      back_image_url?: string | null
    }>()

    const now = Math.floor(Date.now() / 1000)
    const fields: string[] = []
    const values: unknown[] = []

    if (body.type !== undefined) {
      if (body.type !== 'coin' && body.type !== 'note') {
        return c.json({ error: 'type deve ser "coin" ou "note"' }, 400)
      }
      fields.push('type = ?'); values.push(body.type)
    }
    if (body.country !== undefined) { fields.push('country = ?'); values.push(body.country.trim()) }
    if (body.year !== undefined) { fields.push('year = ?'); values.push(body.year) }
    if (body.denomination !== undefined) { fields.push('denomination = ?'); values.push(body.denomination) }
    if (body.currency !== undefined) { fields.push('currency = ?'); values.push(body.currency) }
    if (body.quantity !== undefined) { fields.push('quantity = ?'); values.push(body.quantity) }
    if (body.available_for_trade !== undefined) {
      fields.push('available_for_trade = ?'); values.push(body.available_for_trade ? 1 : 0)
    }
    if (body.commemorative_edition !== undefined) {
      fields.push('commemorative_edition = ?'); values.push(body.commemorative_edition)
    }
    if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description) }
    if (body.front_image_url !== undefined) { fields.push('front_image_url = ?'); values.push(body.front_image_url) }
    if (body.back_image_url !== undefined) { fields.push('back_image_url = ?'); values.push(body.back_image_url) }

    if (fields.length === 0) {
      return c.json({ error: 'Nenhum campo para atualizar' }, 400)
    }

    fields.push('updated_at = ?')
    values.push(now, id)

    await c.env.DB.prepare(`UPDATE items SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run()

    const updated = await c.env.DB.prepare(
      `SELECT *, datetime(created_at, 'unixepoch') as created_at, datetime(updated_at, 'unixepoch') as updated_at
       FROM items WHERE id = ?`,
    )
      .bind(id)
      .first()

    return c.json({ item: updated })
  } catch (err) {
    console.error('[items/:id PUT]', err)
    return c.json({ error: 'Erro ao atualizar item' }, 500)
  }
})

// ─── DELETE /:id ──────────────────────────────────────────────────────────────

items.delete('/:id', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param()
    const authUser = c.get('user') as DbUser

    const existing = await c.env.DB.prepare('SELECT user_id FROM items WHERE id = ?')
      .bind(id)
      .first<{ user_id: string }>()

    if (!existing) return c.json({ error: 'Item não encontrado' }, 404)
    if (existing.user_id !== authUser.id && authUser.is_admin !== 1) {
      return c.json({ error: 'Sem permissão para deletar este item' }, 403)
    }

    // Clean up related records
    await c.env.DB.prepare('DELETE FROM interests WHERE item_id = ?').bind(id).run()
    await c.env.DB.prepare('DELETE FROM messages WHERE item_id = ?').bind(id).run()
    await c.env.DB.prepare('DELETE FROM items WHERE id = ?').bind(id).run()

    return c.json({ message: 'Item deletado com sucesso' })
  } catch (err) {
    console.error('[items/:id DELETE]', err)
    return c.json({ error: 'Erro ao deletar item' }, 500)
  }
})

// ─── POST /:id/interest ───────────────────────────────────────────────────────

items.post('/:id/interest', authMiddleware, async (c) => {
  try {
    const { id: itemId } = c.req.param()
    const authUser = c.get('user') as DbUser

    const item = await c.env.DB.prepare(
      `SELECT i.id, i.user_id, i.type, i.country, i.year, i.denomination, i.currency,
              i.commemorative_edition,
              u.name as owner_name, u.email as owner_email, u.city as owner_city
       FROM items i
       JOIN users u ON u.id = i.user_id
       WHERE i.id = ?`,
    )
      .bind(itemId)
      .first<{
        id: string
        user_id: string
        type: string
        country: string
        year: number | null
        denomination: number | null
        currency: string | null
        commemorative_edition: string | null
        owner_name: string
        owner_email: string
        owner_city: string
      }>()

    if (!item) return c.json({ error: 'Item não encontrado' }, 404)

    if (item.user_id === authUser.id) {
      return c.json({ error: 'Você não pode marcar interesse no seu próprio item' }, 400)
    }

    const now = Math.floor(Date.now() / 1000)

    // Check if already interested (toggle)
    const existing = await c.env.DB.prepare(
      'SELECT id FROM interests WHERE user_id = ? AND item_id = ?',
    )
      .bind(authUser.id, itemId)
      .first<{ id: string }>()

    if (existing) {
      // Remove interest
      await c.env.DB.prepare('DELETE FROM interests WHERE id = ?').bind(existing.id).run()
      return c.json({ interested: false })
    }

    // Add interest
    const interestId = generateId()
    await c.env.DB.prepare(
      'INSERT INTO interests (id, user_id, item_id, created_at) VALUES (?, ?, ?, ?)',
    )
      .bind(interestId, authUser.id, itemId, now)
      .run()

    // Build item description for messages/email
    const parts = [item.type === 'coin' ? 'Moeda' : 'Cédula', '-', item.country]
    if (item.year) parts.push(String(item.year))
    if (item.denomination) parts.push(String(item.denomination))
    if (item.currency) parts.push(item.currency)
    if (item.commemorative_edition) parts.push(`(${item.commemorative_edition})`)
    const itemDescription = parts.join(' ')

    const interestedCity = authUser.city || 'Cidade não informada'

    // Send automatic message to item owner
    const messageId = generateId()
    const messageContent = `Olá! ${authUser.name}, de ${interestedCity}, demonstrou interesse no item '${itemDescription}' da sua coleção.`

    await c.env.DB.prepare(
      `INSERT INTO messages (id, sender_id, receiver_id, item_id, content, read, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
    )
      .bind(messageId, authUser.id, item.user_id, itemId, messageContent, now)
      .run()

    // Send email notification to owner (non-blocking)
    sendEmail(
      {
        to: item.owner_email,
        subject: `${authUser.name} demonstrou interesse na sua coleção — CoinHub`,
        html: interestEmail(item.owner_name, authUser.name, interestedCity, itemDescription),
      },
      c.env.RESEND_API_KEY,
    ).catch((err) => console.error('[items/interest email]', err))

    return c.json({ interested: true })
  } catch (err) {
    console.error('[items/:id/interest POST]', err)
    return c.json({ error: 'Erro ao registrar interesse' }, 500)
  }
})

export { items as itemsRoutes }
