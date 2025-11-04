import { randomBytes } from 'crypto'
import type { APIContext } from 'astro'

/**
 * Middleware to generate a CSP nonce for each request
 * This nonce will be used in the CSP header and in script tags
 */
export async function generateCspNonce(context: APIContext, next: any) {
  const { locals } = context
  // Generate a random nonce for this request
  const nonce = randomBytes(16).toString('base64')

  // Store the nonce in locals so it can be accessed by other middleware and components
  ;(locals as any).cspNonce = nonce

  // Return the result of calling next()
  return next()
}
