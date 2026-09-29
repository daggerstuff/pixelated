#!/usr/bin/env node
// Flaky test detection: runs one advisory bucket twice (no retries —
// retries would mask the non-determinism we are hunting) and compares the
// failed-test sets between runs.
//
//   - a test that fails in exactly one of the two runs is FLAKY → exit 1
//   - a test that fails in both runs is a real bug → exit 2
//   - identical passes → exit 0
//
// Usage: node scripts/ci/flaky-detect.mjs
// Requires VITEST_BUCKET (frontend-components | frontend-hooks |
// frontend-utils); VITEST_SUITE is forced to advisory.

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const bucket = process.env.VITEST_BUCKET;
if (!bucket) {
  console.error('VITEST_BUCKET must be set (frontend-components|frontend-hooks|frontend-utils).');
  process.exit(3);
}

const workDir = mkdtempSync(join(tmpdir(), 'flaky-detect-'));

function runOnce(label) {
  const outputFile = join(workDir, `${label}.json`);
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        'scripts/testing/local-test-runner.cjs',
        'run',
        '--reporter=json',
        `--outputFile=${outputFile}`,
      ],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          VITEST_SUITE: 'advisory',
          VITEST_BUCKET: bucket,
          VITEST_COVERAGE_ENABLED: 'false',
        },
      },
    );
    child.on('error', reject);
    child.on('exit', (code) => {
      // A non-zero vitest exit is expected when tests fail; the JSON report
      // is what matters. Anything beyond "tests failed" (e.g. 2 = config
      // error) still resolves with its code for the caller to distinguish.
      resolve({ code: code ?? 0, outputFile });
    });
  });
}

function failedTestNames(outputFile) {
  const report = JSON.parse(readFileSync(outputFile, 'utf8'));
  const names = new Set();
  for (const suite of report.testResults ?? []) {
    for (const assertion of suite.assertionResults ?? []) {
      if (assertion.status === 'failed') {
        names.add(`${suite.name} > ${assertion.fullName}`);
      }
    }
  }
  return names;
}

const first = await runOnce('run-1');
const second = await runOnce('run-2');

const failuresA = failedTestNames(first.outputFile);
const failuresB = failedTestNames(second.outputFile);

const flaky = [...failuresA].filter((n) => !failuresB.has(n))
  .concat([...failuresB].filter((n) => !failuresA.has(n)));
const consistent = [...failuresA].filter((n) => failuresB.has(n));

console.log(`\nBucket "${bucket}": run 1 → ${failuresA.size} failed, run 2 → ${failuresB.size} failed.`);

if (flaky.length > 0) {
  console.error(`\n❌ ${flaky.length} FLAKY test(s) — different outcomes across identical runs:`);
  for (const name of flaky) console.error(`  - ${name}`);
  console.error('Fix the root cause (shared state, time, or ordering dependence). Do not add retries.');
  process.exit(1);
}

if (consistent.length > 0) {
  console.error(`\n❌ ${consistent.length} test(s) failed in BOTH runs — real failure(s), not flakiness:`);
  for (const name of consistent) console.error(`  - ${name}`);
  process.exit(2);
}

if (first.code !== 0 || second.code !== 0) {
  // Failures reported by vitest but not visible in the JSON — surface it
  // rather than passing silently.
  console.error('\n❌ A run exited non-zero but no failed assertions were parsed from the JSON report.');
  process.exit(3);
}

console.log('\n✅ No flaky tests detected in this bucket.');
