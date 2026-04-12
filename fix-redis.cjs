const fs = require('fs');
let content = fs.readFileSync('src/lib/services/redis/RedisService.ts', 'utf8');

content = content.replace(
`    if (hasUpstashUrl) {
      this.config.url = process.env['UPSTASH_REDIS_REST_URL'] as string
    } else if (hasRedisUrl) {
      this.config.url = process.env['REDIS_URL'] as string`,
`    if (hasUpstashUrl) {
      this.config.url = process.env['UPSTASH_REDIS_REST_URL']!
    } else if (hasRedisUrl) {
      this.config.url = process.env['REDIS_URL']!`
);

content = content.replace(
`        retryStrategy: (times: number) => {
          if (times > (this.config.maxRetries || 3)) {
            return null
          }
          return this.config.retryDelay || 100
        },`,
`        retryStrategy: (times: number) => {
          if (times > (this.config.maxRetries ?? 3)) {
            return null
          }
          return this.config.retryDelay ?? 100
        },`
);

content = content.replace(
`      await Promise.all(
        Array.from(this.subscribers.values()).map((sub) => sub.quit()),
      )`,
`      await Promise.all(
        Array.from(this.subscribers.values()).map(async (sub) => sub.quit()),
      )`
);

content = content.replace(
`      if (process.env['NODE_ENV'] === 'development') {
        logger.warn('Using mock Redis client in development')
        // Create a mock client that implements basic Redis methods
        return this.createMockClient() as Redis
      }`,
`      if (process.env['NODE_ENV'] === 'development') {
        logger.warn('Using mock Redis client in development')
        // Create a mock client that implements basic Redis methods
        return this.createMockClient() as unknown as Redis
      }`
);

content = content.replace(
`  private createMockClient(): Record<string, unknown> {`,
`  private createMockClient(): any {`
);

fs.writeFileSync('src/lib/services/redis/RedisService.ts', content);
