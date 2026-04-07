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

    const prompt = `Você é um especialista em numismática. Com base nas informações abaixo, escreva uma descrição breve (2-3 frases) e informativa sobre este item de coleção para um catálogo online. Seja factual e preciso.

Tipo: ${typeLabel}
País: ${body.country}
Ano: ${yearStr}
Valor: ${denominationStr} ${currencyStr}
Edição comemorativa: ${editionStr}

Responda APENAS com a descrição, sem prefixos.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('[ai/describe] OpenAI error:', response.status, errorBody)
      return c.json({ error: 'Erro ao gerar descrição. Tente novamente.' }, 502)
    }

    const data = await response.json<{
      choices: Array<{
        message: {
          content: string
        }
      }>
    }>()

    const description = data.choices?.[0]?.message?.content?.trim()

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
