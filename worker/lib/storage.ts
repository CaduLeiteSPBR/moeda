/**
 * Cloudflare R2 storage utilities.
 */

/**
 * Upload a file to R2.
 * @returns The public URL path for the stored file.
 */
export async function uploadFile(
  bucket: R2Bucket,
  key: string,
  file: ArrayBuffer,
  contentType: string,
): Promise<string> {
  await bucket.put(key, file, {
    httpMetadata: {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable',
    },
  })
  return getPublicUrl(key)
}

/**
 * Delete a file from R2.
 */
export async function deleteFile(bucket: R2Bucket, key: string): Promise<void> {
  await bucket.delete(key)
}

/**
 * Get the public URL for a stored key.
 * Images are served by the Worker itself at /api/images/{key}.
 */
export function getPublicUrl(key: string): string {
  return `/api/images/${key}`
}

/**
 * Extract the R2 key from a public URL returned by getPublicUrl.
 * Returns null if the URL is not an internal image URL.
 */
export function keyFromUrl(url: string): string | null {
  const prefix = '/api/images/'
  if (url.startsWith(prefix)) {
    return url.slice(prefix.length)
  }
  return null
}
