// Vercel-only serverless wrapper - does NOT affect other deployments
// This file is ONLY used when deploying to Vercel
// 
// IMPORTANT: This handler requires that 'pnpm build' has been run first to create
// the dist/server/entry.mjs file. The vercel.json buildCommand ensures this happens.

// Lazy-load handler to avoid top-level await issues in serverless
let cached

export default async function handler(req, res) {
    try {
        if (!cached) {
            const entry = await import('../../dist/server/entry.mjs')
            if (!entry?.handler) throw new Error('No handler export found in dist/server/entry.mjs')
            cached = entry.handler
        }
        return cached(req, res)
    } catch (error) {
        console.error('Failed to load handler from dist/server/entry.mjs:', error)
        const isProd = process.env.NODE_ENV === 'production'
        const baseError = {
            error: 'INTERNAL_SERVER_ERROR',
            code: 'HANDLER_LOAD_FAILED',
            message: 'Failed to load the application handler. Please check build artifacts.',
        }
        return res.status(500).json({
            ...baseError,
            ...(isProd ? {} : { details: String(error?.message || '') }),
        })
    }
}
