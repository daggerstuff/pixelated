// Redis service wrapper
import { RedisService } from './services/redis/__mocks__/RedisService'

const redisService = new RedisService({})

export { redisService as redis }
