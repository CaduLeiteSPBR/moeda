import { Hono } from 'hono'
import { authMiddleware, adminMiddleware } from '../middleware/auth'
import { generateId } from '../lib/crypto'
import { sendEmail, newMessageEmail } from '../lib/email'
import type { AppContext, DbUser } from '../types'

const messages = new Hono<AppContext>()

// ─── GET /unread-count ────────────────────────────────────────────────────────

messages.get('/unread-count', authMiddleware, async (c) => {
  try {
    const authUser = c.get('user') as DbUser

    const row = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND read = 0',
    )
      .bind(authUser.id)
      .first<{ count: number }>()

    return c.json({ count: row?.count ?? 0 })
  } catch (err) {
    console.error('[messages/unread-count]', err)
    return c.json({ error: 'Erro ao buscar contagem' }, 500)
  }
})

// ─── GET /sent ────────────────────────────────────────────────────────────────

messages.get('/sent', authMiddleware, async (c) => {
  try {
    const authUser = c.get('user') as DbUser
    const page = Math.max(1, parseInt(c.req.query('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? '20')))
    const offset = (page - 1) * limit

    const [rows, countRow] = await Promise.all([
      c.env.DB.prepare(
        `SELECT m.id, m.item_id, m.content, m.read,
                datetime(m.created_at, 'unixepoch') as created_at,
                r.id as receiver_id, r.name as receiver_name, r.city as receiver_city,
                r.avatar_url as receiver_avatar_url
         FROM messages m
         JOIN users r ON r.id = m.receiver_id
         WHERE m.sender_id = ?
         ORDER BY m.created_at DESC
         LIMIT ? OFFSET ?`,
      )
        .bind(authUser.id, limit, offset)
        .all(),
      c.env.DB.prepare('SELECT COUNT(*) as total FROM messages WHERE sender_id = ?')
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
  } catch (err) {
    console.error('[messages/sent]', err)
    return c.json({ error: 'Erro ao listar mensagens enviadas' }, 500)
  }
})

// ─── GET /admin/all ───────────────────────────────────────────────────────────

messages.get('/admin/all', authMiddleware, adminMiddleware, async (c) => {
  try {
    const page = Math.max(1, parseInt(c.req.query('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? '50')))
    const offset = (page - 1) * limit

    const [rows, countRow] = await Promise.all([
      c.env.DB.prepare(
        `SELECT m.id, m.item_id, m.content, m.read,
                datetime(m.created_at, 'unixepoch') as created_at,
                s.id as sender_id, s.name as sender_name, s.city as sender_city,
                r.id as receiver_id, r.name as receiver_name, r.city as receiver_city
         FROM messages m
         JOIN users s ON s.id = m.sender_id
         JOIN users r ON r.id = m.receiver_id
         ORDER BY m.created_at DESC
         LIMIT ? OFFSET ?`,
      )
        .bind(limit, offset)
        .all(),
      c.env.DB.prepare('SELECT COUNT(*) as total FROM messages').first<{ total: number }>(),
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
    console.error('[messages/admin/all]', err)
    return c.json({ error: 'Erro ao listar mensagens' }, 500)
  }
})

// ─── GET / ────────────────────────────────────────────────────────────────────

messages.get('/', authMiddleware, async (c) => {
  try {
    const authUser = c.get('user') as DbUser
    const page = Math.max(1, parseInt(c.req.query('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? '20')))
    const offset = (page - 1) * limit

    const [rows, countRow] = await Promise.all([
      c.env.DB.prepare(
        `SELECT m.id, m.item_id, m.content, m.read,
                datetime(m.created_at, 'unixepoch') as created_at,
                s.id as sender_id, s.name as sender_name, s.city as sender_city,
                s.avatar_url as sender_avatar_url,
                i.type as item_type, i.country as item_country, i.year as item_year
         FROM messages m
         JOIN users s ON s.id = m.sender_id
         LEFT JOIN items i ON i.id = m.item_id
         WHERE m.receiver_id = ?
         ORDER BY m.created_at DESC
         LIMIT ? OFFSET ?`,
      )
        .bind(authUser.id, limit, offset)
        .all(),
      c.env.DB.prepare('SELECT COUNT(*) as total FROM messages WHERE receiver_id = ?')
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
  } catch (err) {
    console.error('[messages/ GET]', err)
    return c.json({ error: 'Erro ao listar mensagens' }, 500)
  }
})

// ─── POST / ───────────────────────────────────────────────────────────────────

messages.post('/', authMiddleware, async (c) => {
  try {
    const authUser = c.get('user') as DbUser
    const { receiver_id, content, item_id } = await c.req.json<{
      receiver_id?: string
      content?: string
      item_id?: string
    }>()

    if (!receiver_id || !content) {
      return c.json({ error: 'receiver_id e content são obrigatórios' }, 400)
    }

    if (content.trim().length === 0) {
      return c.json({ error: 'Mensagem não pode estar vazia' }, 400)
    }

    if (receiver_id === authUser.id) {
      return c.json({ error: 'Você não pode enviar mensagens para si mesmo' }, 400)
    }

    const receiver = await c.env.DB.prepare(
      'SELECT id, name, email, city FROM users WHERE id = ?',
    )
      .bind(receiver_id)
      .first<{ id: string; name: string; email: string; city: string }>()

    if (!receiver) return c.json({ error: 'Destinatário não encontrado' }, 404)

    // Validate item_id if provided
    if (item_id) {
      const item = await c.env.DB.prepare('SELECT id FROM items WHERE id = ?').bind(item_id).first()
      if (!item) return c.json({ error: 'Item não encontrado' }, 404)
    }

    const now = Math.floor(Date.now() / 1000)
    const messageId = generateId()

    await c.env.DB.prepare(
      `INSERT INTO messages (id, sender_id, receiver_id, item_id, content, read, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
    )
      .bind(messageId, authUser.id, receiver_id, item_id ?? null, content.trim(), now)
      .run()

    // Send email notification (non-blocking)
    const senderCity = authUser.city || 'Cidade não informada'
    sendEmail(
      {
        to: receiver.email,
        subject: `${authUser.name} enviou uma mensagem — CoinHub`,
        html: newMessageEmail(receiver.name, authUser.name, senderCity, content.trim()),
      },
      c.env.RESEND_API_KEY,
    ).catch((err) => console.error('[messages/send email]', err))

    const message = await c.env.DB.prepare(
      `SELECT id, sender_id, receiver_id, item_id, content, read,
              datetime(created_at, 'unixepoch') as created_at
       FROM messages WHERE id = ?`,
    )
      .bind(messageId)
      .first()

    return c.json({ message }, 201)
  } catch (err) {
    console.error('[messages/ POST]', err)
    return c.json({ error: 'Erro ao enviar mensagem' }, 500)
  }
})

// ─── PUT /:id/read ────────────────────────────────────────────────────────────

messages.put('/:id/read', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param()
    const authUser = c.get('user') as DbUser

    const msg = await c.env.DB.prepare('SELECT id, receiver_id FROM messages WHERE id = ?')
      .bind(id)
      .first<{ id: string; receiver_id: string }>()

    if (!msg) return c.json({ error: 'Mensagem não encontrada' }, 404)

    if (msg.receiver_id !== authUser.id) {
      return c.json({ error: 'Sem permissão para marcar esta mensagem como lida' }, 403)
    }

    await c.env.DB.prepare('UPDATE messages SET read = 1 WHERE id = ?').bind(id).run()

    return c.json({ message: 'Mensagem marcada como lida' })
  } catch (err) {
    console.error('[messages/:id/read]', err)
    return c.json({ error: 'Erro ao atualizar mensagem' }, 500)
  }
})

export { messages as messagesRoutes }
