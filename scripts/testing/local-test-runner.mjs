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

/**
 * Bucket definitions for advisory sharding. Each bucket targets a disjoint set
 * of test paths so CI matrices can run them in parallel without overlap.
 *
 * Globs are relative to repo root and use forward-slash paths.
 * @type {Record<string, string[]>}
 */
// Advisory buckets split the test corpus into disjoint top-level directories
// so CI matrices can run them in parallel with no overlap. Each bucket owns
// specific top-level dirs; vitest's --include is additive across flags so we
// must pin disjoint segments (no overlapping dir may appear in two buckets).
const ADVISORY_BUCKET_DIRS = {
  // Bucket 1: api/simulator + small/medium lib dirs (~64 files)
  core: [
    "apps/web/src/lib/api",
    "apps/web/src/lib/auth",
    "apps/web/src/lib/server",
    "apps/web/src/lib/stores",
    "apps/web/src/lib/utils",
    "apps/web/src/lib/governance",
    "apps/web/src/lib/__tests__",
    "apps/web/src/lib/audit",
    "apps/web/src/lib/browser",
    "apps/web/src/api",
    "apps/web/src/simulator",
    "apps/web/src/test",
    // tests/api intentionally excluded — Playwright specs, not Vitest (run via `pnpm dlx playwright test tests/api`)
    "tests/unit",
    // singletons
    "apps/web/src/lib/agent-note-collab",
    "apps/web/src/lib/db",
    "apps/web/src/lib/evidence-assistant",
    "apps/web/src/lib/logging",
    "apps/web/src/lib/mental-health",
    "apps/web/src/lib/rate-limit",
    // src/lib/providers intentionally excluded — React component tests need jsdom env + setup.ts (jest-dom, matchMedia), but /lib/ heuristic routes to node project
    "apps/web/src/lib/sdk",
    "apps/web/src/lib/sentry",
    "apps/web/src/lib/styles",
    "apps/web/src/lib/security/threat-intelligence",
    "apps/web/src/lib/websocket",
    "apps/web/src/lib/crypto",
  ],
  // Bucket 2: heaviest lib subdirs + auxiliary top-level suites (~170 files)
  lib: [
    "apps/web/src/lib/ai",
    "apps/web/src/lib/services",
    "apps/web/src/lib/memory",
    "apps/web/src/lib/metaaligner",
    "apps/web/src/lib/security/threat-detection",
    "apps/web/src/lib/security",
    "apps/web/src/lib/hooks",
    "apps/web/src/lib/fhe",
    "apps/web/src/lib/ehr-native",
    "tests/bias-detection",
    "tests/crisis-detection",
    "tests/memory",
    "tests/usability",
    "tests/hooks",
  ],
  // Bucket 3: frontend split into sub-buckets to reduce per-process memory pressure.
  // src/components (React/JSX) is the heaviest and gets its own bucket.
  // src/hooks is moderate but has many small files that benefit from isolation.
  // Everything else (utils, tests, middleware, workers, pages) is lightweight.
  "frontend-components": [
    "apps/web/src/components",
  ],
  "frontend-hooks": [
    "apps/web/src/hooks",
  ],
  "frontend-utils": [
    "apps/web/src/pages",
    "apps/web/src/workers",
    "apps/web/src/middleware",
    "apps/web/src/utils",
    "apps/web/src/tests",
  ],
  // Bucket 4: agents (~17 files)
  agents: ["agents"],
};

/**
 * Build vitest arguments based on VITEST_SUITE.
 * @param {string | undefined} suite
 * @param {string[]} passedArgs - args passed directly to the script
 * @returns {string[]}
 */
function buildVitestArgs(suite, passedArgs) {
  // If specific test files/dirs are passed as positional args, use those directly
  const positionalArgs = passedArgs.filter((arg) => !arg.startsWith("-"));
  if (positionalArgs.length > 0) {
    // When specific paths are passed, don't filter by suite - run those files
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
    const bucket = process.env.VITEST_BUCKET;
    if (bucket) {
      const dirs = ADVISORY_BUCKET_DIRS[bucket];
      if (!dirs || dirs.length === 0) {
        console.error(
          `Unknown VITEST_BUCKET="${bucket}". Known buckets: ${Object.keys(ADVISORY_BUCKET_DIRS).join(", ")}`,
        );
        process.exit(2);
      }
      console.log(`Advisory bucket: ${bucket} (${dirs.length} ${dirs.length === 1 ? 'dir' : 'dirs'})`);
      // Vitest 4 lacks --include/exclude CLI flags at the top level; bucket
      // selection is communicated via VITEST_TARGET_TESTS env (read by the
      // project's vitest.config.ts) which sets include under the hood.
      // Each entry must be a glob; bare dirs don't expand.
      process.env["VITEST_TARGET_TESTS"] = dirs
        .map((dir) => `${dir}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}`)
        .join(";");
    }
    return passedArgs;
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
    NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --max-old-space-size=8192`.trim(),
  },
});

child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error("Failed to run vitest:", err);
  process.exit(1);
});
