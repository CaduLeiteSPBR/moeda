import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authRoutes } from './routes/auth'
import { usersRoutes } from './routes/users'
import { itemsRoutes } from './routes/items'
import { messagesRoutes } from './routes/messages'
import { feedRoutes } from './routes/feed'
import { uploadRoutes } from './routes/upload'
import { aiRoutes } from './routes/ai'
import { adminRoutes } from './routes/admin'
import type { AppContext } from './types'

const app = new Hono<AppContext>()

// ─── Global middleware ────────────────────────────────────────────────────────

app.use('*', logger())

app.use(
  '/api/*',
  cors({
    origin: (origin) => origin, // Reflect origin for dynamic dev + prod support
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  }),
)

// ─── Routes ───────────────────────────────────────────────────────────────────

app.route('/api/auth', authRoutes)
app.route('/api/users', usersRoutes)
app.route('/api/items', itemsRoutes)
app.route('/api/messages', messagesRoutes)
app.route('/api/feed', feedRoutes)
app.route('/api', uploadRoutes)       // Handles /api/upload and /api/images/:key
app.route('/api/ai', aiRoutes)
app.route('/api/admin', adminRoutes)

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/api/health', (c) =>
  c.json({ status: 'ok', timestamp: Date.now() }),
)

// ─── Error handlers ───────────────────────────────────────────────────────────

app.onError((err, c) => {
  console.error('[worker] Unhandled error:', err)
  return c.json({ error: 'Erro interno do servidor' }, 500)
})

app.notFound((c) => c.json({ error: 'Rota não encontrada' }, 404))

export default app
