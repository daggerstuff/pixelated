import type { UnifiedMemory } from '@pixelated/memory-schema'

import {
  ProductMemoryGatewayError,
  type ProductMemoryDeleteInput,
  type ProductMemoryUpdateInput,
  toInternalScope,
} from './product-memory-gateway'

type InternalMemoryServiceClientLike = {
  getMemory: (input: any) => Promise<UnifiedMemory | null>
}

export async function assertOwnedMemoryAccessible(
  client: InternalMemoryServiceClientLike,
  input: ProductMemoryDeleteInput | ProductMemoryUpdateInput,
): Promise<void> {
  const memory = await client.getMemory({
    memoryId: input.memoryId,
    ...toInternalScope(input),
  })

  if (!memory) {
    throw new ProductMemoryGatewayError('Memory not found', 404)
  }
}
