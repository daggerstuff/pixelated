#!/usr/bin/env node
/// <reference types="node" />
// Local test runner that respects VITEST_SUITE and SKIP_TESTS env vars.
//
// VITEST_SUITE values:
//   - "advisory": Run tests that don't need external services (Redis, Auth0, etc.)
//   - "blocking": Run specific critical blocking tests
//   - (unset): Run all tests normally
//
// If SKIP_TESTS is set to "true" (case-insensitive) or "1", the script exits 0 without running tests.

import { spawn } from "node:child_process";
import { resolve, relative } from "node:path";

/**
 * @typedef {import('node:child_process').ChildProcess} LocalChildProcess
 * @typedef {import('node:child_process').SpawnOptions} LocalSpawnOptions
 */

/** @type {string} */
const scriptDir = resolve(process.cwd(), "scripts", "testing");
/** @type {string} */
const skip = (process.env.SKIP_TESTS ?? "").toLowerCase();
if (skip === "true" || skip === "1") {
  console.log("SKIP_TESTS is set - skipping tests (local only)");
  process.exit(0);
}

// Tests that require external services (Redis, Auth0, MongoDB, etc.) and should be excluded from "advisory" suite
const EXTERNAL_SERVICE_TESTS = new Set([
  // Auth0 integration tests
  "tests/integration/auth0/auth0-integration.test.ts",
  // System integration tests that need full stack
  "tests/integration/complete-system.integration.test.ts",
  // Patient crisis integration tests
  "tests/integration/patient-psi-crisis.test.ts",
  // Journal research integration tests
  "tests/integration/journal-research/api.integration.test.ts",
  // Bias detection API integration tests
  "tests/integration/bias-detection-api.integration.test.ts",
  // Session agent integration tests that need MongoDB/Redis
  "agents/session-agent/tests/session-lifecycle.integration.test.ts",
  // QA agent integration tests
  "agents/qa-agent/tests/qa-review-lifecycle.integration.test.ts",
]);

/**
 * Get test files for the "advisory" suite.
 * Advisory suite = unit tests that don't need external services.
 * @returns {string[]}
 */
function getAdvisoryTests() {
  const baseDir = resolve(process.cwd());
  // All src/ tests are unit tests (no external services needed)
  const srcTests = [
    "src/lib/api/",
    "src/lib/audit/",
    "src/lib/browser/",
    "src/lib/metaaligner/",
    "src/lib/server/",
    "src/lib/threat-detection/",
    "src/api/",
    "src/simulator/",
  ];
  // Unit tests in tests/ directory
  const unitTests = ["tests/unit/", "tests/bias-detection/", "tests/api/", "tests/memory/"];
  // Tests in agents/ that are unit tests (not integration)
  const agentUnitTests = [
    "agents/session-agent/tests/*.test.ts",
    "agents/qa-agent/tests/*.test.ts",
  ];

  // Build list of test files to include
  const includePatterns = [
    ...srcTests.map((d) => resolve(baseDir, d, "**/*.test.ts")),
    ...srcTests.map((d) => resolve(baseDir, d, "**/*.test.tsx")),
    ...unitTests.map((d) => resolve(baseDir, d, "**/*.test.ts")),
    ...agentUnitTests.map((p) => resolve(baseDir, p)),
  ];

  // Return empty array - we'll use vitest's --grep and --exclude instead
  // The actual filtering is done via vitest CLI args
  return [];
}

/**
 * Check if a test file path requires external services.
 * @param {string} testPath
 * @returns {boolean}
 */
function requiresExternalServices(testPath) {
  const normalized = testPath.replace(/\\/g, "/");
  return EXTERNAL_SERVICE_TESTS.has(normalized);
}

/**
 * Build vitest arguments based on VITEST_SUITE.
 * @param {string | undefined} suite
 * @param {string[]} passedArgs - args passed directly to the script
 * @returns {string[]}
 */
function buildVitestArgs(suite, passedArgs) {
  // If specific test files are passed as positional args, use those directly
  const positionalArgs = passedArgs.filter((arg) => !arg.startsWith("-"));
  if (positionalArgs.length > 0) {
    // When specific files are passed, don't filter by suite - run those files
    console.log(`Running specific test files: ${positionalArgs.join(", ")}`);
    return passedArgs;
  }

  if (!suite) {
    // No suite specified - run all tests
    return passedArgs;
  }

  const baseDir = resolve(process.cwd());

  if (suite === "advisory") {
    console.log(
      "Running advisory test suite (unit tests only, excluding integration tests needing external services)",
    );
    // Exclude integration tests that need external services
    const excludeArgs = [];
    for (const test of EXTERNAL_SERVICE_TESTS) {
      excludeArgs.push("--exclude");
      excludeArgs.push(resolve(baseDir, test));
    }
    return [...passedArgs, ...excludeArgs];
  }

  if (suite === "blocking") {
    console.log("Running blocking test suite (critical path tests only)");
    // Blocking tests are defined in blocking-test-runner.cjs
    // Those tests should be passed as positional args to this script
    // If we get here without positional args, something is wrong
    return passedArgs;
  }

  // Unknown suite - run as normal
  console.warn(`Unknown VITEST_SUITE: ${suite}. Running all tests.`);
  return passedArgs;
}

const vitestBin = `${scriptDir}/../../node_modules/.bin/${process.platform === "win32" ? "vitest.cmd" : "vitest"}`;
/** @type {string[]} */
const forwardedArgs = process.argv.slice(2);
const hasPositionalArg = forwardedArgs.some((arg) => !arg.startsWith("-"));
if (hasPositionalArg && !process.env.VITEST_COVERAGE_ENABLED) {
  process.env.VITEST_COVERAGE_ENABLED = "false";
}

// Build vitest args based on VITEST_SUITE
const suite = process.env.VITEST_SUITE;
const vitestArgs = buildVitestArgs(suite, forwardedArgs);
const args = ["--config", `${scriptDir}/../../vitest.config.ts`, ...vitestArgs];

/** @type {LocalChildProcess} */
const child = spawn(vitestBin, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV:
      process.env.NODE_ENV && process.env.NODE_ENV !== "production" ? process.env.NODE_ENV : "test",
    NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --max-old-space-size=4096`.trim(),
  },
});

child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error("Failed to run vitest:", err);
  process.exit(1);
});
