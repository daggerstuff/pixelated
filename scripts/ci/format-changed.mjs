#!/usr/bin/env node
/// <reference types="node" />
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

/** @typedef {import('child_process').SpawnSyncReturns<string>} SpawnSyncTextResult */

const EXCLUDED_FROM_OXFMT = new Set([
  "apps/web/src/lib/access-control.ts",
  "apps/web/src/lib/auth/__tests__/integration.test.ts",
  "apps/web/src/lib/auth/__tests__/middleware.test.ts",
  "apps/web/src/lib/auth/auth0-adaptive-mfa-service.ts",
  "apps/web/src/lib/auth/auth0-identity-provider.ts",
  "apps/web/src/lib/auth/auth0-impersonation-service.ts",
  "apps/web/src/lib/auth/auth0-jwt-service.ts",
  "apps/web/src/lib/auth/auth0-middleware.ts",
  "apps/web/src/lib/auth/index.ts",
  "apps/web/src/lib/ehr-native/auth/supervisor-guard.ts",
  "apps/web/src/lib/ehr-native/gates/types.ts",
  "apps/web/src/lib/ehr-native/integrations/hie/types.ts",
  "apps/web/src/lib/ehr-native/services/patient-service.ts",
  "apps/web/src/lib/ehr-native/services/treatment-plan.service.ts",
  "apps/web/src/lib/ehr-native/services/analytics.service.ts",
  "apps/web/src/components/ehr/dashboards/types.ts",
  "apps/web/src/lib/encryption.ts",
  "apps/web/src/lib/fhe/encrypted-memory.ts",
  "apps/web/src/lib/graphql/redis-pubsub.ts",
  "apps/web/src/lib/hooks/journal-research/useWebSocket.ts",
  "apps/web/src/lib/jobs/queue.ts",
  "apps/web/src/lib/patient/patientManager.ts",
  "apps/web/src/lib/research/ResearchPlatform.ts",
  "apps/web/src/lib/research/services/HIPAADataService.ts",
  "apps/web/src/lib/security/consent/ConsentService.ts",
  "apps/web/src/lib/services/BusinessIntelligenceService.ts",
  "apps/web/src/lib/services/auth0.service.ts",
  "apps/web/src/lib/services/patient-rights/__tests__/dataPortabilityService.test.ts",
  "apps/web/src/lib/services/patient-rights/dataPortabilityService.ts",
  "apps/web/src/tests/api/session/skills-api.test.ts",
  "apps/web/src/tests/api/v1/health.test.ts",
  "apps/web/src/types/index.ts",
  "astro.config.mjs",
  "eslint.config.js",
  "packages/sdk-typescript/src/runtime.ts",
  "tests/unit/auth0/auth0-jwt-service.test.ts"
]);

const OXFMT_APPLICABLE_EXTENSIONS = new Set([".js", ".ts", ".mjs", ".cjs", ".mts", ".cts"]);

/** Session dump markdown files are local artifacts and are not formatted. */
const SESSION_DUMP_PATTERN = /^session-ses_[^/]+\.md$/;

/** @param {string[]} files */
function dedupeAndFilterExisting(files) {
  const seen = new Set();
  /** @type {string[]} */
  const results = [];

  for (const filePath of files) {
    if (
      typeof filePath !== "string" ||
      !filePath ||
      SESSION_DUMP_PATTERN.test(filePath)
    ) {
      continue;
    }
    if (!existsSync(filePath)) {
      continue;
    }
    const stats = lstatSync(filePath);
    // Submodule pointers show up as directories; their contents are
    // formatted by the submodule's own repo/CI, not by this check.
    if (stats.isSymbolicLink() || !stats.isFile()) {
      continue;
    }
    if (seen.has(filePath)) {
      continue;
    }

    seen.add(filePath);
    results.push(filePath);
  }

  return results;
}

/** @param {string} command @param {string[]} args */
function runCommand(command, args) {
  /** @type {SpawnSyncTextResult} */
  const result = spawnSync("pnpm", ["-s", command, ...args], {
    stdio: "inherit",
  });
  const exitCode = typeof result.status === "number" ? result.status : 0;
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

/** @param {string} filePath @returns {string[]} */
function readFilesFromPath(filePath) {
  if (!existsSync(filePath)) {
    return [];
  }

  const fileContents = readFileSync(filePath, "utf8");
  return fileContents
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** @returns {string[]} */
function readChangedFilesFromGit() {
  /** @type {SpawnSyncTextResult} */
  const result = spawnSync("git", ["diff", "--name-only", "--diff-filter=ACMRTUXB", "--"], {
    encoding: "utf8",
  });
  const exitCode = typeof result.status === "number" ? result.status : 0;

  if (exitCode !== 0 || typeof result.stdout !== "string") {
    console.error("Failed to read changed files from git");
    process.exit(exitCode || 1);
  }

  return result.stdout
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

const explicitFileListPath = process.argv[2];
const rawChangedFiles =
  typeof explicitFileListPath === "string"
    ? readFilesFromPath(explicitFileListPath)
    : readChangedFilesFromGit();
const changedFiles = dedupeAndFilterExisting(rawChangedFiles);

if (changedFiles.length === 0) {
  console.log("No files to format-check.");
  process.exit(0);
}

runCommand("prettier", ["--check", "--ignore-unknown", ...changedFiles]);

const oxfmtFiles = changedFiles.filter((filePath) => {
  if (EXCLUDED_FROM_OXFMT.has(filePath)) {
    return false;
  }

  const extension = filePath.slice(filePath.lastIndexOf("."));
  return OXFMT_APPLICABLE_EXTENSIONS.has(extension);
});

if (oxfmtFiles.length > 0) {
  runCommand("oxfmt", ["--check", "--no-error-on-unmatched-pattern", ...oxfmtFiles]);
}
