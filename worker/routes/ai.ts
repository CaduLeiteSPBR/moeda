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

// ─── POST /identify ───────────────────────────────────────────────────────────

ai.post('/identify', authMiddleware, async (c) => {
  try {
    const body = await c.req.json<{ image_key?: string }>()

    if (!body.image_key) {
      return c.json({ error: 'image_key é obrigatório' }, 400)
    }

    // Busca imagem no R2
    const object = await c.env.R2.get(body.image_key)
    if (!object) {
      return c.json({ error: 'Imagem não encontrada' }, 404)
    }

    const arrayBuffer = await object.arrayBuffer()
    const contentType = object.httpMetadata?.contentType ?? 'image/jpeg'

    // Converte para base64 em chunks para evitar stack overflow em arquivos grandes
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
    }
    const base64 = btoa(binary)

    const prompt = `Você é um especialista em numismática. Analise esta imagem de uma moeda ou cédula e identifique os dados. Responda APENAS com JSON válido, sem markdown, sem texto extra, sem explicações:
{"type":"coin ou note","country":"nome do país em português","year":número ou null,"denomination":valor numérico ou null,"currency":"código ISO da moeda (BRL/USD/EUR/GBP/ARS etc) ou null","commemorative_edition":"descrição da edição comemorativa se houver ou null"}`

    // Modelo de visão da Cloudflare Workers AI
    const response = await (c.env.AI as unknown as {
      run: (model: string, input: unknown) => Promise<unknown>
    }).run('@cf/meta/llama-3.2-11b-vision-instruct', {
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${contentType};base64,${base64}` },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      max_tokens: 256,
    })

    const text = ((response as { response?: string }).response ?? '').trim()

    // Extrai JSON (o modelo às vezes adiciona texto antes/depois)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return c.json({ error: 'Não foi possível identificar o item na imagem' }, 422)
    }

    let data: Record<string, unknown>
    try {
      data = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    } catch {
      return c.json({ error: 'Resposta inválida do modelo de IA' }, 422)
    }

    return c.json({
      type: (data.type as string) ?? null,
      country: (data.country as string) ?? null,
      year: (data.year as number) ?? null,
      denomination: (data.denomination as number) ?? null,
      currency: (data.currency as string) ?? null,
      commemorative_edition: (data.commemorative_edition as string) ?? null,
    })
  } catch (err) {
    console.error('[ai/identify]', err)
    return c.json({ error: 'Erro ao identificar item' }, 500)
  }
})

export { ai as aiRoutes }
