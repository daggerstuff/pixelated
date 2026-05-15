const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let lines = content.split('\n');
  let newLines = [];
  let modified = false;
  let i = 0;
  while (i < lines.length) {
    if (i + 1 < lines.length && lines[i].startsWith('description: >-') && lines[i+1].trim() === '---') {
      let descLines = [];
      let j = i + 2;
      while (j < lines.length && lines[j].startsWith(' ')) {
        descLines.push(lines[j].trim());
        j++;
      }
      let fullDesc = descLines.join(' ').replace(/"/g, '\\"');
      newLines.push(`description: "${fullDesc}"`);
      i = j;
      modified = true;
      continue;
    }
    if (i + 1 < lines.length && lines[i].startsWith('description:') && !lines[i].includes('"') && lines[i+1].trim() === '---') {
      // Check if the next lines are indented, indicating a multi-line description
      let j = i + 2;
      let isMultiLine = false;
      while (j < lines.length && lines[j].startsWith(' ')) {
        isMultiLine = true;
        j++;
      }
      if (isMultiLine) {
        let descLines = [];
        j = i + 2;
        while (j < lines.length && lines[j].startsWith(' ')) {
          let stripped = lines[j].trim();
          if (stripped.startsWith("'") && stripped.endsWith("'")) {
            stripped = stripped.slice(1, -1);
          }
          descLines.push(stripped);
          j++;
        }
        let fullDesc = descLines.join(' ').replace(/"/g, '\\"');
        newLines.push(`description: "${fullDesc}"`);
        i = j;
        modified = true;
        continue;
      } else {
        // If it's a single-line description, do not modify it
        newLines.push(lines[i]);
        i++;
        continue;
      }
    }
    newLines.push(lines[i]);
    i++;
  }
  if (modified) {
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
    console.log(`Fixed ${filePath}`);
  }
}

function traverse(dir) {
  let files = fs.readdirSync(dir);
  for (let file of files) {
    let fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverse(fullPath);
    } else if (fullPath.endsWith('.md')) {
      fixFile(fullPath);
    }
  }
}

traverse('src/content-store');