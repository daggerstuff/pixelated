#!/bin/bash

# 1. server.prod.ts
sed -i "s/(process.argv\[1\]?.includes('server.prod.ts') ?? false)) ??/(process.argv[1]?.includes('server.prod.ts') ?? false) ??/g" src/server.prod.ts

# 2. developer-api-keys.test.ts
sed -i 's/createMockQueryResult<{ id: string }>(\[\], 0)/createMockQueryResult(\[\], 0)/g' src/lib/db/developer-api-keys.test.ts

# 3. objective-injector.ts
# Since I used `objectives: resolvedObjectives as any,` before
# I'll replace the block to cast the entire object.
sed -i 's/objectives: resolvedObjectives as any,/objectives: resolvedObjectives,/g' src/lib/metaaligner/objectives/objective-injector.ts
sed -i 's/        ...request.context,/        ...(request.context as any),/g' src/lib/metaaligner/objectives/objective-injector.ts

# 4. rate-limit.ts
sed -i '/this.defaultLimit = defaultLimit/d' src/lib/middleware/rate-limit.ts

# 5. connection.ts
sed -i 's/export function setRedisClient(client: any): void {/export function setRedisClient(client: typeof redisClient): void {/g' src/lib/database/connection.ts

