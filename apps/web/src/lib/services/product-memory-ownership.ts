import type { InternalMemoryServiceClientLike } from '../server/memory-transport-factory'
import {
  ProductMemoryGatewayError,
  type ProductMemoryDeleteInput,
  type ProductMemoryUpdateInput,
  toInternalScope,
} from './product-memory-gateway'

type GetMemoryOnly = Pick<InternalMemoryServiceClientLike, 'getMemory'>

export async function assertOwnedMemoryAccessible(
  client: GetMemoryOnly,
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
