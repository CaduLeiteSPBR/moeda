/**
 * JWT implementation using Web Crypto API (HMAC-SHA256).
 * Compatible with Cloudflare Workers — no external dependencies.
 */

// ─── Base64URL helpers ────────────────────────────────────────────────────────

function base64urlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64urlDecode(str: string): Uint8Array {
  // Restore padding
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + ((4 - (str.length % 4)) % 4), '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function encodeObject(obj: object): string {
  return base64urlEncode(new TextEncoder().encode(JSON.stringify(obj)))
}

// ─── Sign ─────────────────────────────────────────────────────────────────────

/**
 * Sign a JWT with HMAC-SHA256.
 * @param payload  Object to embed in the token.
 * @param secret   HMAC secret string.
 * @param expiresIn Expiry in seconds (default: 7 days).
 */
export async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  expiresIn = 60 * 60 * 24 * 7, // 7 days
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)

  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  }

  const headerB64 = encodeObject(header)
  const payloadB64 = encodeObject(fullPayload)
  const signingInput = `${headerB64}.${payloadB64}`

  const key = await importKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput))

  return `${signingInput}.${base64urlEncode(signature)}`
}

// ─── Verify ───────────────────────────────────────────────────────────────────

/**
 * Verify a JWT and return its payload, or null if invalid/expired.
 */
export async function verifyJwt(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [headerB64, payloadB64, signatureB64] = parts
    const signingInput = `${headerB64}.${payloadB64}`

    const key = await importKey(secret)
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64urlDecode(signatureB64),
      new TextEncoder().encode(signingInput),
    )

    if (!valid) return null

    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64))) as Record<string, unknown>

    // Check expiry
    const now = Math.floor(Date.now() / 1000)
    if (typeof payload.exp === 'number' && payload.exp < now) return null

    return payload
  } catch {
    return null
  }
}

// ─── Key import helper ────────────────────────────────────────────────────────

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}
