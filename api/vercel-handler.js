// Vercel-only serverless wrapper - does NOT affect other deployments
// This file is ONLY used when deploying to Vercel
// 
// IMPORTANT: This handler requires that 'pnpm build' has been run first to create
// the dist/server/entry.mjs file. The vercel.json buildCommand ensures this happens.
import { handler } from '../dist/server/entry.mjs'

export default handler

