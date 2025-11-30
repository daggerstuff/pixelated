// Vercel-only serverless wrapper - does NOT affect other deployments
// This file is ONLY used when deploying to Vercel
import { handler } from '../dist/server/entry.mjs'

export default handler

