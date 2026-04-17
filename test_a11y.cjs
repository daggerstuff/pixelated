const fs = require('fs');

const content = fs.readFileSync('src/components/admin/DataDeletionRequestForm.astro', 'utf8');

const validations = [
  { regex: /<div class="space-y-4" role="radiogroup" aria-labelledby="deletion-scope-label">/, name: 'Deletion Scope radiogroup' },
  { regex: /<h3 id="deletion-scope-label"/, name: 'Deletion Scope label id' },
  { regex: /<div id="data-categories-container"[^>]*role="group"/, name: 'Data Categories group role' },
  { regex: /<div id="data-categories-container"[^>]*aria-labelledby="data-categories-label"/, name: 'Data Categories aria-labelledby' },
  { regex: /<p id="data-categories-label"/, name: 'Data Categories label id' }
];

let failed = false;
for (const validation of validations) {
  if (!validation.regex.test(content)) {
    console.error(`Failed to find ${validation.name}`);
    failed = true;
  }
}

if (!failed) {
  console.log('All a11y checks passed locally in test script.');
} else {
  process.exit(1);
}
