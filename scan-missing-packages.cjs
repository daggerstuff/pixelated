const fs = require('fs');
const path = require('path');

// Get the current package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const allDeps = new Set([
  ...Object.keys(packageJson.dependencies || {}),
  ...Object.keys(packageJson.devDependencies || {})
]);

console.log('🔍 SCANNING FOR MISSING IMPORTS...\n');

// Function to extract imports from file content
function extractImports(content, filePath) {
  const imports = [];
  
  // Match various import patterns
  const patterns = [
    // ES6 imports: import ... from 'module'
    /import\s+(?:[\w\s{},*]+\s+from\s+)?['"`]([^'"`]+)['"`]/g,
    // Dynamic imports: import('module')
    /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    // Require calls: require('module')
    /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const importPath = match[1];
      
      // Skip relative imports (starting with . or /)
      if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
        // Extract package name (handle scoped packages)
        let packageName = importPath;
        if (importPath.startsWith('@')) {
          // Scoped package: @scope/package or @scope/package/subpath
          const parts = importPath.split('/');
          packageName = parts.slice(0, 2).join('/');
        } else {
          // Regular package: package or package/subpath
          packageName = importPath.split('/')[0];
        }
        
        imports.push(packageName);
      }
    }
  });
  
  return [...new Set(imports)]; // Remove duplicates
}

// Function to scan directory recursively
function scanDirectory(dir, extensions = ['.js', '.ts', '.tsx', '.jsx', '.astro', '.mjs', '.cjs']) {
  const results = [];
  
  function scanDir(currentDir) {
    try {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip node_modules and other build directories
          if (!['node_modules', 'dist', '.git', '.astro'].includes(item)) {
            scanDir(fullPath);
          }
        } else if (stat.isFile()) {
          const ext = path.extname(item);
          if (extensions.includes(ext)) {
            try {
              const content = fs.readFileSync(fullPath, 'utf8');
              const imports = extractImports(content, fullPath);
              if (imports.length > 0) {
                results.push({
                  file: fullPath,
                  imports
                });
              }
            } catch (e) {
              // Skip files that can't be read
            }
          }
        }
      }
    } catch (e) {
      // Skip directories that can't be read
    }
  }
  
  scanDir(dir);
  return results;
}

// Scan the project
const scanResults = scanDirectory('./src');

// Collect all unique imports
const allImports = new Set();
const missingPackages = new Set();

scanResults.forEach(result => {
  result.imports.forEach(imp => {
    allImports.add(imp);
    if (!allDeps.has(imp)) {
      missingPackages.add(imp);
    }
  });
});

console.log(`📊 SCAN RESULTS:`);
console.log(`  • Files scanned: ${scanResults.length}`);
console.log(`  • Unique imports found: ${allImports.size}`);
console.log(`  • Missing packages: ${missingPackages.size}\n`);

if (missingPackages.size > 0) {
  console.log('❌ MISSING PACKAGES:');
  const sortedMissing = Array.from(missingPackages).sort();
  sortedMissing.forEach((pkg, index) => {
    console.log(`  ${index + 1}. ${pkg}`);
  });
  
  console.log('\n🔧 SUGGESTED COMMANDS:');
  
  // Group packages for installation
  const dependencyPackages = [];
  const devDependencyPackages = [];
  
  sortedMissing.forEach(pkg => {
    // Heuristic to determine if it should be a dev dependency
    if (pkg.includes('test') || pkg.includes('mock') || 
        pkg.startsWith('@types/') || pkg.includes('eslint') || 
        pkg.includes('babel') || pkg.includes('webpack') ||
        pkg.includes('vite') || pkg.includes('rollup') ||
        ['@astrojs/rss', 'archiver'].includes(pkg)) {
      devDependencyPackages.push(pkg);
    } else {
      dependencyPackages.push(pkg);
    }
  });
  
  if (dependencyPackages.length > 0) {
    console.log(`\n  Dependencies (${dependencyPackages.length}):`);
    console.log(`  pnpm add ${dependencyPackages.join(' ')}`);
  }
  
  if (devDependencyPackages.length > 0) {
    console.log(`\n  DevDependencies (${devDependencyPackages.length}):`);
    console.log(`  pnpm add -D ${devDependencyPackages.join(' ')}`);
  }
  
} else {
  console.log('✅ NO MISSING PACKAGES FOUND!');
}

console.log('\n📋 SUMMARY:');
console.log('This scan identifies packages that are imported but not listed in package.json.');
console.log('Some packages might be built-in Node.js modules or provided by other packages.');
console.log('Review the list and install only the packages that are actually needed.');
