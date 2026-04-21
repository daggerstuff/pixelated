import { InternalMemoryServiceClient } from "@/lib/server/internal-memory-service-client";
import {
  ProductMemoryGatewayError,
  type ProductMemoryDeleteInput,
  type ProductMemoryUpdateInput,
  toInternalScope,
} from "@/lib/services/product-memory-gateway";

export async function assertOwnedMemoryAccessible(
  client: InternalMemoryServiceClient,
  input: ProductMemoryDeleteInput | ProductMemoryUpdateInput,
): Promise<void> {
  const memory = await client.getMemory({
    memoryId: input.memoryId,
    ...toInternalScope(input),
  });

  if (!memory) {
    throw new ProductMemoryGatewayError("Memory not found", 404);
  }
}
