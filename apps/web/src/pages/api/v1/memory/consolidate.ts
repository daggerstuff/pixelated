import { ConsolidationPipeline } from '@/lib/memory/consolidation/consolidation-pipeline'
/**
 * @file src/pages/api/v1/memory/consolidate.ts
 *
 * POST /api/v1/memory/consolidate — run the full consolidation pipeline.
 *
 * Pipeline phases (in order):
 *   1. TF-IDF dedup → merge near-duplicate memories (keeps highest-importance)
 *   2. REM dreaming  → cross-link semantically similar memories, extract schemas
 *   3. Forgetting    → Ebbinghaus decay → archive old, prune very old
 *
 * This is an authenticated endpoint. Only the memory owner can consolidate
 * their own memories. Intended for explicit triggers (cron, admin action) —
 * not called automatically on every memory write.
 */
import { jsonResponse } from '@/lib/memory/contract/route-helpers'
import { withV1Contract } from '@/lib/middleware/with-v1-contract'
import { getProductMemoryGateway } from '@/lib/services/product-memory-gateway'

export const POST = withV1Contract(
  'consolidateMemory',
  async (context, caller) => {
    const gateway = getProductMemoryGateway()
    const pipeline = new ConsolidationPipeline()

    const report = await pipeline.run(gateway, caller.scope.userId)

    return jsonResponse({ data: { report } })
  },
)
