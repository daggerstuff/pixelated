#!/usr/bin/env node
/**
 * check-react-router.mjs
 *
 * Regression guard to ensure that `react-router` and `react-router-dom`
 * are not reintroduced into the dependency tree.
 *
 * Background: `react-router` was previously flagged for advisory 1124282
 * (RSC mode CSRF bypass). The project has no direct usage of
 * `react-router-dom` in `src/`, so the dependency was removed. This guard
 * fails CI if any version of `react-router` or `react-router-dom` is
 * resolved in the lockfile.
 */

import { execFileSync } from 'node:child_process';

const packages = ['react-router', 'react-router-dom'];
let found = false;

for (const pkg of packages) {
  try {
    const output = execFileSync('pnpm', ['why', pkg, '--json'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const trimmed = output.trim();
    if (trimmed && trimmed !== '[]') {
      console.error(`❌ ${pkg} is present in the dependency tree:`);
      console.error(trimmed);
      found = true;
    }
  } catch {
    // pnpm exits non-zero when the package is not found, which is what we want.
  }
}

if (found) {
  console.error(
    '\n❌ react-router / react-router-dom detected. These packages were removed due to advisory 1124282.'
  );
  console.error('   If a patched version (>=8.3.0) is available, update this guard and re-introduce it.');
  process.exit(1);
}

console.log('✅ react-router and react-router-dom are not present in the dependency tree.');
