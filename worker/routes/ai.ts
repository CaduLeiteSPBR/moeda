import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import type { AppContext } from '../types'

const ai = new Hono<AppContext>()

// ─── POST /describe ───────────────────────────────────────────────────────────

ai.post('/describe', authMiddleware, async (c) => {
  try {
    const body = await c.req.json<{
      type?: string
      country?: string
      year?: number | string
      denomination?: number | string
      currency?: string
      commemorative_edition?: string
    }>()

    if (!body.type || !body.country) {
      return c.json({ error: 'type e country são obrigatórios' }, 400)
    }

    const typeLabel = body.type === 'coin' ? 'Moeda' : body.type === 'note' ? 'Cédula' : body.type
    const yearStr = body.year ? String(body.year) : 'Não informado'
    const denominationStr = body.denomination ? String(body.denomination) : 'Não informado'
    const currencyStr = body.currency ?? 'Não informado'
    const editionStr = body.commemorative_edition ?? 'Não'

    const prompt = `Você é um especialista em numismática. Com base nas informações abaixo, escreva uma descrição breve (2-3 frases) e informativa sobre este item de coleção para um catálogo online. Seja factual e preciso. Responda APENAS com a descrição, sem prefixos ou introduções.

Tipo: ${typeLabel}
País: ${body.country}
Ano: ${yearStr}
Valor: ${denominationStr} ${currencyStr}
Edição comemorativa: ${editionStr}`

    // Usando Cloudflare Workers AI — gratuito, sem chave externa
    const response = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em numismática. Responda sempre em português brasileiro. Seja conciso e factual.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 200,
    })

    const description = (response as { response?: string }).response?.trim()

    if (!description) {
      return c.json({ error: 'Não foi possível gerar uma descrição' }, 502)
    }

    return c.json({ description })
  } catch (err) {
    console.error('[ai/describe]', err)
    return c.json({ error: 'Erro ao gerar descrição' }, 500)
  }
})

export { ai as aiRoutes }
