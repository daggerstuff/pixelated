import { clerkMiddleware, createRouteMatcher } from '@clerk/astro/server'
import { generateCspNonce } from './lib/middleware/csp'
import { sequence } from 'astro/middleware'

const isProtectedRoute = createRouteMatcher([
  '/api/clerk-protected-example(.*)',
])

const clerkAuthMiddleware = clerkMiddleware((auth, context) => {
  const { redirectToSignIn, userId } = auth()
  if (!userId && isProtectedRoute(context.request)) {
    return redirectToSignIn()
  }
  return undefined
})

// Allow disabling auth in tests/CI to avoid external dependencies
const AUTH_DISABLED =
  process.env['DISABLE_AUTH'] === 'true' || process.env['NODE_ENV'] === 'test'

// Single, clean middleware sequence
export const onRequest = AUTH_DISABLED
  ? sequence(generateCspNonce)
  : sequence(generateCspNonce, clerkAuthMiddleware)
