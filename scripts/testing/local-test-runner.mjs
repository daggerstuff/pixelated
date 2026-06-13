#!/usr/bin/env node
/// <reference types="node" />
// Local test runner that respects SKIP_TESTS env var.
// If SKIP_TESTS is set to "true" (case-insensitive) or "1", the script exits 0 without running tests.
// Otherwise it forwards arguments to vitest.

import { spawn } from "node:child_process";
import { resolve } from "node:path";

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

const vitestBin = `${scriptDir}/../../node_modules/.bin/${process.platform === "win32" ? "vitest.cmd" : "vitest"}`;
/** @type {string[]} */
const forwardedArgs = process.argv.slice(2);
const hasPositionalArg = forwardedArgs.some((arg) => !arg.startsWith("-"));
if (hasPositionalArg && !process.env.VITEST_COVERAGE_ENABLED) {
  process.env.VITEST_COVERAGE_ENABLED = "false";
}
const args = ["--config", `${scriptDir}/../../vitest.config.ts`, ...forwardedArgs];

/** @type {LocalChildProcess} */
const child = spawn(vitestBin, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV:
      process.env.NODE_ENV && process.env.NODE_ENV !== "production" ? process.env.NODE_ENV : "test",
  },
});

child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error("Failed to run vitest:", err);
  process.exit(1);
});
