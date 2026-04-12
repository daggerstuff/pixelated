const fs = require('fs');
let content = fs.readFileSync('src/config/mongodb.config.ts', 'utf8');

content = content.replace(
`    const metaEnv =
      typeof import.meta === 'object' &&
      typeof import.meta.env === 'object' &&
      import.meta.env !== null &&
      'MONGODB_URI' in import.meta.env &&
      typeof import.meta.env['MONGODB_URI'] === 'string'
        ? import.meta.env['MONGODB_URI']
        : undefined`,
`    const metaEnv =
      typeof process !== 'undefined' && process.env['MONGODB_URI']
        ? process.env['MONGODB_URI']
        : undefined;`
);

content = content.replace(
`    process.env['MONGODB_URI'] ??= metaEnv
    const mongoUri = process.env['MONGODB_URI']`,
`    const mongoUri = process.env['MONGODB_URI'] ?? metaEnv`
);

fs.writeFileSync('src/config/mongodb.config.ts', content);
