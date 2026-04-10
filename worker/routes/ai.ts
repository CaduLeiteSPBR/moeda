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
      return c.json({ error: 'Imagem não encontrada no armazenamento' }, 404)
    }

    const arrayBuffer = await object.arrayBuffer()

    // Cloudflare Workers AI (llama-3.2-11b-vision-instruct) espera
    // a imagem como array de números no campo `image` (nível raiz),
    // e o prompt como texto no campo `prompt` — não o formato OpenAI image_url.
    const imageBytes = Array.from(new Uint8Array(arrayBuffer))

    // ── Passo 1: LLaVA descreve a imagem em linguagem natural ────────────────
    const visionResponse = await (c.env.AI as unknown as {
      run: (model: string, input: unknown) => Promise<unknown>
    }).run('@cf/llava-hf/llava-1.5-7b-hf', {
      image: imageBytes,
      prompt: 'Describe this coin or banknote in detail. Include the country of origin, year, denomination value, currency name, and any commemorative text visible.',
      max_tokens: 200,
    })

    const description = ((visionResponse as { description?: string; response?: string }).description
      ?? (visionResponse as { response?: string }).response
      ?? '').trim()

    console.log('[ai/identify] vision description:', description)

    if (!description) {
      return c.json({
        error: 'O modelo de visão não conseguiu descrever a imagem. Tente com uma foto mais nítida.',
      }, 422)
    }

    // ── Passo 2: Llama extrai JSON estruturado da descrição ───────────────────
    const extractResponse = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em numismática. Extraia dados estruturados de descrições de moedas e cédulas. Responda APENAS com JSON válido, sem markdown, sem texto extra.',
        },
        {
          role: 'user',
          content: `Com base nesta descrição de uma moeda ou cédula, retorne APENAS um JSON válido:
Descrição: "${description}"

JSON esperado (use null para campos não identificados):
{"type":"coin ou note","country":"nome do país em português","year":número ou null,"denomination":número ou null,"currency":"código ISO (BRL/USD/EUR/GBP/ARS etc) ou null","commemorative_edition":"descrição da edição comemorativa ou null"}`,
        },
      ],
      max_tokens: 200,
    })

    const raw = ((extractResponse as { response?: string }).response ?? '').trim()

    console.log('[ai/identify] extraction raw:', raw)

    // Extrai JSON da resposta (o modelo às vezes adiciona texto ao redor)
    const jsonMatch = raw.match(/\{[\s\S]*?\}/)
    if (!jsonMatch) {
      return c.json({
        error: `Identificado como: "${description.substring(0, 120)}". Preencha os campos manualmente.`,
      }, 422)
    }

    let data: Record<string, unknown>
    try {
      data = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    } catch {
      return c.json({
        error: `Identificado como: "${description.substring(0, 120)}". Preencha os campos manualmente.`,
      }, 422)
    }

    return c.json({
      type: (data.type as string) ?? null,
      country: (data.country as string) ?? null,
      year: data.year ? Number(data.year) : null,
      denomination: data.denomination ? Number(data.denomination) : null,
      currency: (data.currency as string) ?? null,
      commemorative_edition: (data.commemorative_edition as string) ?? null,
    })
  } catch (err) {
    console.error('[ai/identify] exception:', err)
    return c.json({
      error: `Erro interno: ${err instanceof Error ? err.message : String(err)}`,
    }, 500)
  }
})

export { ai as aiRoutes }
