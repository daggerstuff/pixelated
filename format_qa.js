const fs = require('fs');
const content = fs.readFileSync('.Jules/qa.md', 'utf8');

const updated = content.replace(/## 2026-05-18 - isValidDate testing edge case\n- Pattern: Adding tests to previously untested pure functions that validate calendar-based date strings and checking logic around invalid month\/day configurations and leap years\.\n- Action: Write localized edge case tests focusing on edge-cases specifically, use `npx vitest run src\/utils\/formatDate\.test\.ts` to execute locally since tests and linters failed globally\./, '## 2026-05-18 - isValidDate testing edge case | Pattern: Adding tests to previously untested pure functions that validate calendar-based date strings and checking logic around invalid month/day configurations and leap years. | Action: Write localized edge case tests focusing on edge-cases specifically, use `npx vitest run src/utils/formatDate.test.ts` to execute locally since tests and linters failed globally.')

fs.writeFileSync('.Jules/qa.md', updated);
