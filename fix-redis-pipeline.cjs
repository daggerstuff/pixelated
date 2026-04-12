const fs = require('fs');
let content = fs.readFileSync('src/lib/services/redis/RedisService.ts', 'utf8');

content = content.replace(
`          del: (key: string) => {
            commands.push({ cmd: 'del', args: [key] })
            return mockClient as Redis
          },`,
`          del: (key: string) => {
            commands.push({ cmd: 'del', args: [key] })
            return mockClient as unknown as Redis
          },`
);

fs.writeFileSync('src/lib/services/redis/RedisService.ts', content);
