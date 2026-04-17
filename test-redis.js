import { readFileSync } from 'fs';
const content = readFileSync('src/lib/redis.test.ts', 'utf-8');
console.log(content.includes('redis === mockRedis'));
