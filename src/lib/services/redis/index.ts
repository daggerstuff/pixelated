// Barrel export for redis service
// The codebase imports from '@/lib/services/redis' or '../services/redis'.
// For now re-export the mock RedisService used in tests and a shared instance
// to satisfy imports during server build.

import { RedisService } from './__mocks__/RedisService'

const redis = new RedisService({})

export { RedisService, redis }
