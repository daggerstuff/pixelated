// IMPORTANT: Import instrument.mjs at the very top to initialize Sentry
import '../instrument.mjs'

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

// Single, clean middleware sequence
export const onRequest = sequence(generateCspNonce, clerkAuthMiddleware)
