#!/bin/bash

# 1. objective-injector.ts
sed -i 's/objectives: resolvedObjectives,/objectives: resolvedObjectives as any,/g' src/lib/metaaligner/objectives/objective-injector.ts

# 2. rate-limit.ts
sed -i '/private readonly defaultLimit: number/d' src/lib/middleware/rate-limit.ts

# 4. threat-detection/integrations/index.ts
sed -i 's/    config,/    config as any,/g' src/lib/threat-detection/integrations/index.ts

# 5. auth0-analytics-charts.ts
sed -i 's/data: scatterData,/data: scatterData as any,/g' src/pages/api/auth/auth0-analytics-charts.ts

# 6. health.ts
sed -i "s/uptime: serverStatus\['uptime'\] as unknown as any,/uptime: serverStatus['uptime'] as number,/g" src/api/routes/health.ts

# 7. database/connection.ts
sed -i 's/redisClient = client as unknown as any/redisClient = client/g' src/lib/database/connection.ts

# 8. privacyEngine.ts
sed -i 's/this.globalModel = await this.createGlobalModel()/this.globalModel = this.createGlobalModel()/g' src/lib/ai/privacyEngine.ts

# 9. universal-demo-analytics.ts
sed -i 's/error_reason: e.reason?.toString(),/error_reason: String(e.reason),/g' src/lib/analytics/universal-demo-analytics.ts

# 10. server.prod.ts
sed -i "s/(process.argv\[1\]?.includes('server.prod.js') ||/(process.argv[1]?.includes('server.prod.js') ?? false) ||/g" src/server.prod.ts
sed -i "s/    process.argv\[1\]?.includes('server.prod.ts')) ??/    (process.argv[1]?.includes('server.prod.ts') ?? false)) ??/g" src/server.prod.ts

# 11. developer-api-keys.test.ts
sed -i 's/const createMockQueryResult = <TRow>(rows: TRow\[\], rowCount = rows.length) =>/const createMockQueryResult = (rows: any[], rowCount = rows.length) =>/g' src/lib/db/developer-api-keys.test.ts

# 3. ExternalThreatFeedIntegration.ts (manual fix since it's large and reverted)
