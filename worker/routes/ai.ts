import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import type { AppContext } from '../types'

const ai = new Hono<AppContext>()

// Tenta o melhor modelo disponível com fallback automático
const GEMINI_MODELS = ['gemini-2.5-pro', 'gemini-1.5-flash']

const GEMINI_URL = (model: string, apiKey: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

// ─── Helper: chama a API do Gemini com fallback automático ────────────────────

async function callGemini(
  apiKey: string,
  parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }>,
  maxTokens = 256,
  temperature = 0.2,
): Promise<string> {
  let lastError = ''

  for (const model of GEMINI_MODELS) {
    const res = await fetch(GEMINI_URL(model, apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      }),
    })

    // 503 = sobrecarga temporária → tenta próximo modelo
    if (res.status === 503 || res.status === 429) {
      lastError = `Gemini API error ${res.status} on ${model}`
      console.warn(`[ai] ${lastError}, trying fallback...`)
      continue
    }

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gemini API error ${res.status}: ${err.slice(0, 200)}`)
    }

    const json = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }

    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
    console.log(`[ai] responded by ${model}`)
    return text
  }

  throw new Error(`Todos os modelos indisponíveis. ${lastError}`)
}

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

    const typeLabel = body.type === 'coin' ? 'Moeda' : 'Cédula'
    const prompt = `Você é um especialista em numismática. Com base nas informações abaixo, escreva uma descrição breve (2-3 frases) e informativa sobre este item de coleção para um catálogo online. Seja factual e preciso. Responda APENAS com a descrição, sem prefixos ou introduções.

Tipo: ${typeLabel}
País: ${body.country}
Ano: ${body.year ?? 'Não informado'}
Valor: ${body.denomination ?? 'Não informado'} ${body.currency ?? ''}
Edição comemorativa: ${body.commemorative_edition ?? 'Não'}`

    const description = await callGemini(c.env.GEMINI_API_KEY, [{ text: prompt }], 300, 0.4)

    if (!description) {
      return c.json({ error: 'Não foi possível gerar uma descrição' }, 502)
    }

    return c.json({ description })
  } catch (err) {
    console.error('[ai/describe]', err)
    return c.json({ error: err instanceof Error ? err.message : 'Erro ao gerar descrição' }, 500)
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
    const contentType = object.httpMetadata?.contentType ?? 'image/jpeg'

    // Converte para base64
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
    }
    const base64 = btoa(binary)

    const prompt = `Você é um especialista em numismática. Analise esta imagem de uma moeda ou cédula com muito cuidado.

Identifique e retorne APENAS um JSON válido, sem markdown, sem texto extra:
{"type":"coin ou note","country":"nome do país em português","year":número do ano ou null,"denomination":valor numérico EXATO impresso (ex: se vir '10' retorne 10, se vir '50' retorne 50) ou null,"currency":"código ISO de 3 letras (BRL/USD/EUR/GBP/ARS/etc) ou null","commemorative_edition":"texto comemorativo se houver ou null"}

Atenção especial:
- Leia o valor impresso com cuidado (não confunda 10 com 1, nem 100 com 10)
- O ano deve ser o da emissão/série visível na nota ou moeda
- Para cédulas americanas, a moeda é USD`

    const raw = await callGemini(
      c.env.GEMINI_API_KEY,
      [
        { inline_data: { mime_type: contentType, data: base64 } },
        { text: prompt },
      ],
      300,
      0.1,
    )

    console.log('[ai/identify] gemini raw:', raw)

    const jsonMatch = raw.match(/\{[\s\S]*?\}/)
    if (!jsonMatch) {
      return c.json({
        error: `Identificado como: "${raw.slice(0, 150)}". Preencha os campos manualmente.`,
      }, 422)
    }

    let data: Record<string, unknown>
    try {
      data = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    } catch {
      return c.json({
        error: `Identificado como: "${raw.slice(0, 150)}". Preencha os campos manualmente.`,
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
    console.error('[ai/identify]', err)
    return c.json({ error: err instanceof Error ? err.message : 'Erro ao identificar item' }, 500)
  }
})

export { ai as aiRoutes }
