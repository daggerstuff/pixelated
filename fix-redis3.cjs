const fs = require('fs');
let content = fs.readFileSync('src/lib/services/redis/RedisService.ts', 'utf8');

content = content.replace(
`  public async getSubscriber(channelName: string): Promise<Redis> {
    // If we're in development, just return a mock client
    if (process.env['NODE_ENV'] === 'development') {
      return this.createMockClient() as unknown as Redis
    }`,
`  public async getSubscriber(channelName: string): Promise<Redis> {
    // If we're in development, just return a mock client
    if (process.env['NODE_ENV'] === 'development') {
      return this.createMockClient() as unknown as Redis
    }`
);

content = content.replace(
`  public async getSubscriber(channelName: string): Promise<Redis> {
    // If we're in development, just return a mock client
    if (process.env['NODE_ENV'] === 'development') {
      return this.createMockClient() as Redis
    }`,
`  public async getSubscriber(channelName: string): Promise<Redis> {
    // If we're in development, just return a mock client
    if (process.env['NODE_ENV'] === 'development') {
      return this.createMockClient() as unknown as Redis
    }`
);

content = content.replace(
`  public async getCacheClient(): Promise<Redis> {
    // Return standard client for now, but allows future optimization
    // (e.g. connecting to a specific Redis instance for cache vs pub/sub)
    if (process.env['NODE_ENV'] === 'development') {
      return this.createMockClient() as Redis
    }`,
`  public async getCacheClient(): Promise<Redis> {
    // Return standard client for now, but allows future optimization
    // (e.g. connecting to a specific Redis instance for cache vs pub/sub)
    if (process.env['NODE_ENV'] === 'development') {
      return this.createMockClient() as unknown as Redis
    }`
);

fs.writeFileSync('src/lib/services/redis/RedisService.ts', content);
