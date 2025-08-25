const fs = require('fs');

try {
  const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

  // Gather all Astro, @astrojs, and astro- extensions that may be required at runtime.
  const astroIncludePrefixes = [
    '@astrojs/',
    'astro-',
    'astro'
  ];
  const extraAstroDeps = {};
  Object.keys(pkg.dependencies || {}).forEach(dep => {
    if (
      astroIncludePrefixes.some(prefix => dep.startsWith(prefix)) &&
      !['astro', '@astrojs/node', '@astrojs/react'].includes(dep)
    ) {
      extraAstroDeps[dep] = pkg.dependencies[dep];
    }
  });
  // Also check for key astro extensions in devDependencies if "astro-*" or "@astrojs/*"
  Object.keys(pkg.devDependencies || {}).forEach(dep => {
    if (
      astroIncludePrefixes.some(prefix => dep.startsWith(prefix)) &&
      !(dep in extraAstroDeps)
    ) {
      extraAstroDeps[dep] = pkg.devDependencies[dep];
    }
  });

  const prodPkg = {
    name: pkg.name,
    version: pkg.version,
    type: pkg.type,
    dependencies: {
      // Core runtime dependencies only
      'astro': pkg.dependencies?.astro || pkg.devDependencies?.astro,
      '@astrojs/node': pkg.dependencies?.['@astrojs/node'],
      '@astrojs/react': pkg.dependencies?.['@astrojs/react'],
      ...extraAstroDeps,
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
