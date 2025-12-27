// Vercel-only serverless wrapper - does NOT affect other deployments
// This file is ONLY used when deploying to Vercel
// 
// IMPORTANT: This handler requires that 'pnpm build' has been run first to create
// the dist/server/entry.mjs file. The vercel.json buildCommand ensures this happens.

let handler;
try {
    const entry = await import('../../dist/server/entry.mjs');
    // The entry module exports 'handler' as a named export
    handler = entry.handler;
    if (!handler) {
        throw new Error('No handler export found in dist/server/entry.mjs');
    }
} catch (error) {
    console.error('Failed to load handler from dist/server/entry.mjs:', error);
    // Fallback handler that returns an error
    handler = (req, res) => {
        res.status(500).json({
            error: 'INTERNAL_SERVER_ERROR',
            code: 'HANDLER_LOAD_FAILED',
            message: 'Failed to load the application handler. Please check build artifacts.',
            details: error.message
        });
    };
}

export default handler
