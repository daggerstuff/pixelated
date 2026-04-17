import fs from 'fs';
const path = 'src/lib/redis.test.ts';
let code = fs.readFileSync(path, 'utf8');
code = code.replace(
  'process.env.REDIS_URL = "redis://localhost:6379";',
  'process.env.REDIS_URL = "redis://localhost:6379";\n  delete process.env.UPSTASH_REDIS_REST_URL;\n  delete process.env.UPSTASH_REDIS_REST_TOKEN;'
);
fs.writeFileSync(path, code);
