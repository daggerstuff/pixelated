import { InternalMemoryServiceClient } from '@/lib/server/internal-memory-service-client'
import {
  ProductMemoryGatewayError,
  type ProductMemoryDeleteInput,
  type ProductMemoryUpdateInput,
} from '@/lib/services/product-memory-gateway'

export async function assertOwnedMemoryAccessible(
  client: InternalMemoryServiceClient,
  input: ProductMemoryDeleteInput | ProductMemoryUpdateInput,
): Promise<void> {
  const memory = await client.getMemory({
    memoryId: input.memoryId,
    userId: input.userId,
    orgId: input.orgId,
    projectId: input.projectId,
    sessionId: input.sessionId,
    agentId: input.agentId,
    runId: input.runId,
    includeShared: input.includeShared,
  })

  if (!memory) {
    throw new ProductMemoryGatewayError('Memory not found', 404)
  }
}
