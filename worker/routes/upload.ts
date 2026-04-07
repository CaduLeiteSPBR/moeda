import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { uploadFile } from '../lib/storage'
import { generateToken } from '../lib/crypto'
import type { AppContext, DbUser } from '../types'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
}

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

const upload = new Hono<AppContext>()

// ─── POST /upload ─────────────────────────────────────────────────────────────

upload.post('/upload', authMiddleware, async (c) => {
  try {
    const authUser = c.get('user') as DbUser

    const formData = await c.req.formData()
    const file = formData.get('file')

    if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
      return c.json({ error: 'Campo "file" é obrigatório' }, 400)
    }

    const fileObj = file as File
    const contentType = fileObj.type
    const ext = ALLOWED_TYPES[contentType]

    if (!ext) {
      return c.json(
        {
          error: 'Tipo de arquivo não suportado. Use JPEG, PNG, WebP ou HEIC.',
        },
        400,
      )
    }

    const arrayBuffer = await fileObj.arrayBuffer()

    if (arrayBuffer.byteLength > MAX_SIZE) {
      return c.json({ error: 'Arquivo muito grande. Máximo permitido: 10MB.' }, 400)
    }

    const random = generateToken().slice(0, 8)
    const timestamp = Date.now()
    const key = `${authUser.id}/${timestamp}-${random}.${ext}`

    const url = await uploadFile(c.env.R2, key, arrayBuffer, contentType)

    return c.json({ key, url }, 201)
  } catch (err) {
    console.error('[upload/POST]', err)
    return c.json({ error: 'Erro ao fazer upload da imagem' }, 500)
  }
})

// ─── GET /images/:key ─────────────────────────────────────────────────────────

upload.get('/images/:key{.+}', async (c) => {
  try {
    const key = c.req.param('key')

    const object = await c.env.R2.get(key)

    if (!object) {
      return c.json({ error: 'Imagem não encontrada' }, 404)
    }

    const headers = new Headers()
    object.writeHttpMetadata(headers)

    // Ensure content type is set
    if (!headers.get('Content-Type')) {
      const ext = key.split('.').pop()?.toLowerCase()
      const typeMap: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        heic: 'image/heic',
      }
      headers.set('Content-Type', typeMap[ext ?? ''] ?? 'application/octet-stream')
    }

    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    headers.set('ETag', object.httpEtag)

    return new Response(object.body, { headers })
  } catch (err) {
    console.error('[images/GET]', err)
    return c.json({ error: 'Erro ao buscar imagem' }, 500)
  }
})

export { upload as uploadRoutes }
