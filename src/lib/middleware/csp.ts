// Minimal CSP nonce middleware for Astro
export const generateCspNonce = async (context, next) => {
  // Generate a random nonce for CSP
  const nonce = Math.random().toString(36).substring(2, 18)
  context.locals = context.locals || {}
  context.locals['cspNonce'] = nonce
  return await next()
}
