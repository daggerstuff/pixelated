import { randomBytes } from 'crypto'

import type { APIContext, MiddlewareHandler } from 'astro'

type CSPContext = APIContext & {
  locals: APIContext['locals'] & {
    cspNonce?: string
  }
}

/**
 * Middleware to generate a CSP nonce for each request
 * This nonce will be used in the CSP header and in script tags
 */
export const generateCspNonce: MiddlewareHandler = async (
  context: CSPContext,
  next,
) => {
  const { locals } = context
  // Generate a random nonce for this request
  const nonce = randomBytes(16).toString('base64')

  // Store the nonce in locals so it can be accessed by other middleware and components
  locals.cspNonce = nonce

  // Return the result of calling next()
  return next()
}
