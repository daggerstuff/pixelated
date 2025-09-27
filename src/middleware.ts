import { generateCspNonce } from './lib/middleware/csp'
import { securityHeaders } from './lib/middleware/securityHeaders'
import { sequence } from 'astro/middleware'

// Single, clean middleware sequence (Clerk removed)
export const onRequest = sequence(generateCspNonce, securityHeaders)
