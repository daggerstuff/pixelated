const fs = require('fs');

// Read package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const {scripts} = packageJson;

// Check for tools/packages that might no longer be installed
const potentiallyMissingPackages = [
  'astro-bundle-analyzer',
  'lighthouse', 
  'k6',
  'trunk',
  'cursor-mcp-installer-free'
];

// Categories for organization
const categories = {
  'Core Development': [],
  'Building & Bundling': [],
  'Code Quality & Linting': [],
  'Testing': [],
  'Database & Services': [],
  'AI & ML': [],
  'Security': [],
  'Performance': [],
  'Deployment': [],
  'Docker': [],
  'Version & Tag Management': [],
  'TypeScript Debugging': [],
  'Utilities & Tools': [],
  'Miscellaneous': []
};

// Problematic scripts that reference packages no longer installed
const problematicScripts = [];

// Categorize scripts
Object.entries(scripts).forEach(([name, command]) => {
  // Check for potentially missing packages
  potentiallyMissingPackages.forEach(pkg => {
    if (command.includes(pkg)) {
      problematicScripts.push({
        script: name,
        command: command,
        missingPackage: pkg
      });
    }
  });

  // Categorize based on script name and content
  if (name.includes('dev') || name === 'start' || name === 'preview' || name === 'sync') {
    categories['Core Development'].push({name, command});
  } else if (name.includes('build') || name.includes('analyze')) {
    categories['Building & Bundling'].push({name, command});
  } else if (name.includes('lint') || name.includes('format') || name.includes('check') || name.includes('typecheck')) {
    categories['Code Quality & Linting'].push({name, command});
  } else if (name.includes('test') || name.includes('e2e') || name.includes('performance:test')) {
    categories['Testing'].push({name, command});
  } else if (name.includes('mongodb') || name.includes('redis') || name.includes('memory') || name.includes('backup')) {
    categories['Database & Services'].push({name, command});
  } else if (name.includes('ai') || name.includes('bias') || name.includes('model') || name.includes('dialogue') || name.includes('dataset')) {
    categories['AI & ML'].push({name, command});
  } else if (name.includes('security')) {
    categories['Security'].push({name, command});
  } else if (name.includes('performance') || name.includes('lighthouse') || name.includes('optimize')) {
    categories['Performance'].push({name, command});
  } else if (name.includes('deploy') || name.includes('rollback') || name.includes('vercel')) {
    categories['Deployment'].push({name, command});
  } else if (name.includes('docker')) {
    categories['Docker'].push({name, command});
  } else if (name.includes('version') || name.includes('tag')) {
    categories['Version & Tag Management'].push({name, command});
  } else if (name.includes('ts:')) {
    categories['TypeScript Debugging'].push({name, command});
  } else if (name.includes('toolbar') || name.includes('trunk') || name.includes('fmt') || name.includes('mcp') || name.includes('blog') || name.includes('schedule')) {
    categories['Utilities & Tools'].push({name, command});
  } else {
    categories['Miscellaneous'].push({name, command});
  }
});

console.log('=== SCRIPT ORGANIZATION ANALYSIS ===\n');

console.log('🚨 POTENTIALLY PROBLEMATIC SCRIPTS:');
if (problematicScripts.length > 0) {
  problematicScripts.forEach(item => {
    console.log(`  ❌ "${item.script}": References "${item.missingPackage}" which may not be installed`);
    console.log(`     Command: ${item.command}`);
  });
} else {
  console.log('  ✅ No obvious issues found');
}

console.log('\n📋 SCRIPT CATEGORIZATION:\n');

Object.entries(categories).forEach(([category, scripts]) => {
  if (scripts.length > 0) {
    console.log(`📁 ${category} (${scripts.length} scripts):`);
    scripts.forEach(script => {
      console.log(`   • ${script.name}: ${script.command}`);
    });
    console.log('');
  }
});

// Generate organized scripts section
console.log('🔧 SUGGESTED ORGANIZED SCRIPTS SECTION:\n');

const organizedScripts = {};

// Add scripts in order of categories
[
  'Core Development',
  'Building & Bundling', 
  'Code Quality & Linting',
  'Testing',
  'Database & Services',
  'AI & ML',
  'Security',
  'Performance', 
  'Deployment',
  'Docker',
  'Version & Tag Management',
  'TypeScript Debugging',
  'Utilities & Tools',
  'Miscellaneous'
].forEach(category => {
  if (categories[category].length > 0) {
    categories[category].forEach(script => {
      organizedScripts[script.name] = script.command;
    });
  }
});

console.log('  "scripts": {');
let scriptCount = 0;
const totalScripts = Object.keys(organizedScripts).length;
Object.entries(organizedScripts).forEach(([name, command]) => {
  scriptCount++;
  const comma = scriptCount < totalScripts ? ',' : '';
  console.log(`    "${name}": "${command}"${comma}`);
});
console.log('  }');

console.log('\n📊 SUMMARY:');
console.log(`• Total scripts: ${Object.keys(scripts).length}`);
console.log(`• Potentially problematic: ${problematicScripts.length}`);
console.log(`• Categorized: ${Object.keys(organizedScripts).length}`);
