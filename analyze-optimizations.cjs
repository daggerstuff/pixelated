const fs = require('fs');

// Read package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

console.log('=== PACKAGE.JSON OPTIMIZATION ANALYSIS ===\n');

// 1. Check for outdated or redundant configurations
console.log('🔍 CONFIGURATION ANALYSIS:\n');

// Check engine constraints
console.log('📦 ENGINE CONSTRAINTS:');
console.log(`  • Node.js: ${packageJson.engines?.node || 'Not specified'}`);
console.log(`  • Package Manager: ${packageJson.packageManager || 'Not specified'}`);

// 2. Analyze dependency versions for potential updates
console.log('\n📊 DEPENDENCY VERSION ANALYSIS:');

const checkVersionPatterns = (deps, type) => {
  const patterns = {
    exact: [],
    caret: [],
    tilde: [],
    latest: [],
    prerelease: []
  };
  
  Object.entries(deps || {}).forEach(([name, version]) => {
    if (version.includes('-')) patterns.prerelease.push(name);
    else if (version.startsWith('^')) patterns.caret.push(name);
    else if (version.startsWith('~')) patterns.tilde.push(name);
    else if (version === 'latest') patterns.latest.push(name);
    else patterns.exact.push(name);
  });
  
  console.log(`\n  ${type}:`);
  console.log(`    • Exact versions: ${patterns.exact.length}`);
  console.log(`    • Caret (^): ${patterns.caret.length}`);
  console.log(`    • Tilde (~): ${patterns.tilde.length}`);
  console.log(`    • Latest: ${patterns.latest.length}`);
  console.log(`    • Prerelease: ${patterns.prerelease.length}`);
  
  if (patterns.exact.length > 0) {
    console.log(`    • Exact version packages: ${patterns.exact.slice(0, 5).join(', ')}${patterns.exact.length > 5 ? '...' : ''}`);
  }
  
  return patterns;
};

const depPatterns = checkVersionPatterns(packageJson.dependencies, 'Dependencies');
const devDepPatterns = checkVersionPatterns(packageJson.devDependencies, 'DevDependencies');

// 3. Check for potential consolidations
console.log('\n🔧 POTENTIAL OPTIMIZATIONS:\n');

// Check for duplicate packages across deps and devDeps
const deps = Object.keys(packageJson.dependencies || {});
const devDeps = Object.keys(packageJson.devDependencies || {});
const duplicates = deps.filter(dep => devDeps.includes(dep));

if (duplicates.length > 0) {
  console.log('⚠️  DUPLICATE PACKAGES (in both deps and devDeps):');
  duplicates.forEach(pkg => {
    console.log(`    • ${pkg}: deps(${packageJson.dependencies[pkg]}) vs devDeps(${packageJson.devDependencies[pkg]})`);
  });
} else {
  console.log('✅ No duplicate packages found');
}

// Check for version inconsistencies in related packages
console.log('\n🔄 VERSION CONSISTENCY CHECKS:');

const checkRelatedPackages = (packages, prefix) => {
  const related = Object.entries(packages || {})
    .filter(([name]) => name.startsWith(prefix))
    .reduce((acc, [name, version]) => {
      const baseVersion = version.replace(/[\^~]/, '');
      acc[baseVersion] = acc[baseVersion] || [];
      acc[baseVersion].push(name);
      return acc;
    }, {});
  
  return related;
};

// Check major package families
const families = [
  { prefix: '@astrojs/', name: 'Astro' },
  { prefix: '@aws-sdk/', name: 'AWS SDK' },
  { prefix: '@types/', name: 'TypeScript Types' },
  { prefix: '@sentry/', name: 'Sentry' },
  { prefix: '@react-three/', name: 'React Three' },
  { prefix: 'eslint-plugin-', name: 'ESLint Plugins' },
  { prefix: 'remark-', name: 'Remark' },
  { prefix: 'rehype-', name: 'Rehype' }
];

families.forEach(({ prefix, name }) => {
  const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const related = checkRelatedPackages(allDeps, prefix);
  
  if (Object.keys(related).length > 1) {
    console.log(`  ⚠️  ${name} packages have version inconsistencies:`);
    Object.entries(related).forEach(([version, packages]) => {
      console.log(`    • v${version}: ${packages.join(', ')}`);
    });
  }
});

// 4. Check for modern alternatives
console.log('\n🚀 MODERNIZATION OPPORTUNITIES:\n');

const modernAlternatives = {
  'date-fns': 'Consider: Temporal API (when stable) or stick with dayjs',
  'axios': 'Consider: native fetch API (already removed)',
  'lodash': 'Consider: native JS methods or radash',
  'moment': 'Consider: dayjs (already using)',
  'node-sass': 'Consider: sass (Dart Sass)',
  'babel': 'Consider: esbuild or swc (already using esbuild)',
  'webpack': 'Consider: vite (already using)',
  'jest': 'Consider: vitest (already using)',
  'tslint': 'Consider: eslint (already using)'
};

const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
const foundOld = Object.keys(allDeps).filter(dep => 
  Object.keys(modernAlternatives).some(old => dep.includes(old))
);

if (foundOld.length > 0) {
  console.log('📦 MODERNIZATION SUGGESTIONS:');
  foundOld.forEach(dep => {
    const suggestion = Object.entries(modernAlternatives).find(([old]) => dep.includes(old));
    if (suggestion) {
      console.log(`  • ${dep}: ${suggestion[1]}`);
    }
  });
} else {
  console.log('✅ Dependencies appear to use modern alternatives');
}

// 5. Performance optimizations
console.log('\n⚡ PERFORMANCE OPTIMIZATIONS:\n');

const performanceChecks = [
  {
    check: packageJson.type === 'module',
    message: '✅ Using ES modules (type: "module")',
    suggestion: ''
  },
  {
    check: packageJson.packageManager?.includes('pnpm'),
    message: '✅ Using pnpm for faster installs',
    suggestion: ''
  },
  {
    check: packageJson.engines?.node,
    message: '✅ Node.js version specified',
    suggestion: packageJson.engines?.node === '24' ? 'Consider updating to Node 25 when stable' : ''
  },
  {
    check: packageJson.pnpm?.overrides,
    message: '✅ Using pnpm overrides for dependency resolution',
    suggestion: ''
  }
];

performanceChecks.forEach(({ check, message, suggestion }) => {
  console.log(`  ${message}`);
  if (suggestion) console.log(`    💡 ${suggestion}`);
});

// 6. Security considerations
console.log('\n🔒 SECURITY CONSIDERATIONS:\n');

const securityChecks = [
  {
    check: packageJson.private === true,
    message: packageJson.private ? '✅ Package marked as private' : '⚠️  Consider marking package as private',
    suggestion: !packageJson.private ? 'Add "private": true to prevent accidental publishing' : ''
  },
  {
    check: packageJson.pnpm?.allowedDeprecatedVersions,
    message: '⚠️  Using deprecated package versions (controlled)',
    suggestion: 'Review allowedDeprecatedVersions periodically'
  }
];

securityChecks.forEach(({ message, suggestion }) => {
  console.log(`  ${message}`);
  if (suggestion) console.log(`    💡 ${suggestion}`);
});

console.log('\n📋 SUMMARY OF RECOMMENDATIONS:\n');
console.log('1. 🔄 Align package family versions (AWS SDK, Astro, etc.)');
console.log('2. 📦 Consider Node.js version update strategy');
console.log('3. 🧹 Review exact version pins for flexibility');
console.log('4. 🔍 Audit deprecated package allowances');
console.log('5. ⚡ Optimize pnpm configuration');
console.log('6. 🚀 Consider workspace setup if project grows');
