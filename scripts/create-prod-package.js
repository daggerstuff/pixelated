const fs = require('fs');

try {
  const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

  const prodPkg = {
    name: pkg.name,
    version: pkg.version,
    type: pkg.type,
    dependencies: {
      // Core runtime dependencies only
      'astro': pkg.dependencies?.astro || pkg.devDependencies?.astro,
      '@astrojs/node': pkg.dependencies?.['@astrojs/node'],
      '@astrojs/react': pkg.dependencies?.['@astrojs/react'],
      'react': pkg.dependencies?.react,
      'react-dom': pkg.dependencies?.['react-dom'],
      // Essential utilities
      'clsx': pkg.dependencies?.clsx,
      'nanoid': pkg.dependencies?.nanoid,
      'zod': pkg.dependencies?.zod,
      // Database connections
      'mongodb': pkg.dependencies?.mongodb,
      'redis': pkg.dependencies?.redis,
      'pg': pkg.dependencies?.pg,
      // Security
      'bcryptjs': pkg.dependencies?.bcryptjs,
      'jsonwebtoken': pkg.dependencies?.jsonwebtoken,
      // HTTP client
      'axios': pkg.dependencies?.axios,
      // Date utilities
      'date-fns': pkg.dependencies?.['date-fns']
    },
    scripts: {
      start: pkg.scripts?.start
    }
  };

  // Remove undefined dependencies
  Object.keys(prodPkg.dependencies).forEach(key => {
    if (!prodPkg.dependencies[key]) {
      delete prodPkg.dependencies[key];
    }
  });

  fs.writeFileSync('./package.prod.json', JSON.stringify(prodPkg, null, 2));
  console.log('Production package.json created successfully');
} catch (error) {
  console.error('Error creating production package.json:', error);
  process.exit(1);
}
