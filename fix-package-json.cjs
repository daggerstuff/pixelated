const fs = require('fs');

// Read the backup file
const packageText = fs.readFileSync('package.json.backup', 'utf8');

try {
  // Try to parse the current structure
  const packageData = JSON.parse(packageText);
  console.log('✅ Backup file is valid JSON');
  
  // Write it back to fix formatting
  fs.writeFileSync('package.json', JSON.stringify(packageData, null, 2));
  console.log('✅ Fixed package.json formatting');
  
} catch (error) {
  console.error('❌ Backup file has JSON issues:', error.message);
  
  // If backup is corrupted, let's try to fix manually
  let lines = packageText.split('\n');
  let inDevDeps = false;
  let inPnpm = false;
  let braceLevel = 0;
  let fixedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip orphaned entries that come after a closing brace but before pnpm
    if (line.trim().startsWith('"@types/') && 
        i > 0 && 
        lines[i-1].trim() === '},') {
      console.log('Skipping orphaned line:', line.trim());
      continue;
    }
    
    fixedLines.push(line);
  }
  
  fs.writeFileSync('package.json.fixed', fixedLines.join('\n'));
  console.log('✅ Created manually fixed version as package.json.fixed');
}
