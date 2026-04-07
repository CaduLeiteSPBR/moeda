/**
 * Cryptographic utilities using Web Crypto API
 * Compatible with Cloudflare Workers (no node:crypto)
 */

/**
 * Hash a password using PBKDF2-SHA256 with 100,000 iterations.
 * Returns "salt:hash" encoded in hex.
 */
export async function hashPassword(password: string): Promise<string> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16))
  const salt = bufferToHex(saltBytes)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: saltBytes,
      iterations: 100_000,
    },
    keyMaterial,
    256,
  )

  const hash = bufferToHex(new Uint8Array(derived))
  return `${salt}:${hash}`
}

/**
 * Verify a password against a stored "salt:hash" string.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, expectedHash] = stored.split(':')
  if (!saltHex || !expectedHash) return false

  const saltBytes = hexToBuffer(saltHex)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: saltBytes,
      iterations: 100_000,
    },
    keyMaterial,
    256,
  )

  const actualHash = bufferToHex(new Uint8Array(derived))

  // Constant-time comparison
  return constantTimeEqual(actualHash, expectedHash)
}

/**
 * Generate a random 32-byte hex token.
 */
export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return bufferToHex(bytes)
}

/**
 * Generate a UUID v4.
 */
export function generateId(): string {
  return crypto.randomUUID()
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

/** Constant-time string comparison to prevent timing attacks. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}
