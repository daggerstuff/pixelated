#!/usr/bin/env node
/**
 * Validates all OpenAPI spec files in the repository using @stoplight/spectral.
 * Exits 1 if any spec fails validation (errors only, warnings are reported).
 *
 * Usage:
 *   node scripts/ci/validate-openapi.js                # validate all specs
 *   node scripts/ci/validate-openapi.js <spec-file>     # validate a specific spec
 */

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");

// All OpenAPI spec files in the repo (relative to repo root)
const SPEC_FILES = [
  "docs/api-reference/openapi.yaml",
  "docs/api-reference/openapi.json",
  "src/pages/docs/api/_openapi.yaml",
  "src/content-store/docs/api/openapi/openapi.yaml",
  "docs/api/memory-v1.openapi.yaml",
];

// Colors for terminal output
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

/**
 * Check if spectral is available (npx will download if not cached).
 */
function checkSpectral() {
  try {
    execSync("npx @stoplight/spectral-cli --version", {
      cwd: REPO_ROOT,
      stdio: "pipe",
      timeout: 30000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate a single OpenAPI spec file with spectral.
 * Returns { file, errors, warnings, infos, passed }.
 */
function validateSpec(specPath) {
  const fullPath = join(REPO_ROOT, specPath);

  if (!existsSync(fullPath)) {
    console.log(`${YELLOW}  SKIP${RESET} ${specPath} (file not found)`);
    return { file: specPath, errors: 0, warnings: 0, infos: 0, passed: true, skipped: true };
  }

  try {
    // Run spectral lint and capture JSON output
    const output = execSync(
      `npx @stoplight/spectral-cli lint "${fullPath}" --ruleset "${join(REPO_ROOT, ".spectral.yaml")}" --format json`,
      {
        cwd: REPO_ROOT,
        stdio: "pipe",
        timeout: 60000,
        encoding: "utf8",
      },
    );

    const results = JSON.parse(output);
    const diagnostics = Array.isArray(results) ? results : [results];

    let errors = 0;
    let warnings = 0;
    let infos = 0;

    for (const diag of diagnostics) {
      if (diag.severity === 0) errors++;
      else if (diag.severity === 1) warnings++;
      else infos++;
    }

    if (errors > 0) {
      console.log(`${RED}  FAIL${RESET} ${specPath} — ${errors} error(s), ${warnings} warning(s)`);
      // Print error details
      for (const diag of diagnostics) {
        if (diag.severity !== 0) continue;
        const line = diag.range?.start?.line ?? "?";
        const col = diag.range?.start?.character ?? "?";
        console.log(`       ${RED}ERROR${RESET} [${line}:${col}] ${diag.code}: ${diag.message}`);
      }
    } else if (warnings > 0) {
      console.log(`${YELLOW}  PASS${RESET} ${specPath} — ${warnings} warning(s), ${infos} info(s)`);
    } else {
      console.log(`${GREEN}  PASS${RESET} ${specPath} — clean`);
    }

    return { file: specPath, errors, warnings, infos, passed: errors === 0, skipped: false };
  } catch (err) {
    // Spectral exits non-zero on errors — parse stderr for results
    const stderr = err.stderr?.toString() ?? "";
    const stdout = err.stdout?.toString() ?? "";

    // Try to parse JSON from stdout (spectral outputs JSON even on error)
    try {
      const results = JSON.parse(stdout);
      const diagnostics = Array.isArray(results) ? results : [results];

      let errors = 0;
      let warnings = 0;
      let infos = 0;

      for (const diag of diagnostics) {
        if (diag.severity === 0) errors++;
        else if (diag.severity === 1) warnings++;
        else infos++;
      }

      if (errors > 0) {
        console.log(
          `${RED}  FAIL${RESET} ${specPath} — ${errors} error(s), ${warnings} warning(s)`,
        );
        for (const diag of diagnostics) {
          if (diag.severity !== 0) continue;
          const line = diag.range?.start?.line ?? "?";
          const col = diag.range?.start?.character ?? "?";
          console.log(`       ${RED}ERROR${RESET} [${line}:${col}] ${diag.code}: ${diag.message}`);
        }
      } else {
        console.log(`${YELLOW}  PASS${RESET} ${specPath} — ${warnings} warning(s)`);
      }

      return { file: specPath, errors, warnings, infos, passed: errors === 0, skipped: false };
    } catch {
      console.log(`${RED}  ERROR${RESET} ${specPath} — spectral failed to run`);
      console.log(`       ${stderr.split("\n").slice(0, 3).join("\n       ")}`);
      return { file: specPath, errors: 1, warnings: 0, infos: 0, passed: false, skipped: false };
    }
  }
}

// --- Main ---
console.log(`${BOLD}${CYAN}OpenAPI Spec Validation${RESET}\n`);

// Validate specific file or all specs
const targetFile = process.argv[2];
const files = targetFile ? [targetFile] : SPEC_FILES;

console.log(`Validating ${files.length} spec file(s)...\n`);

const results = files.map(validateSpec);

// Summary
console.log(`\n${BOLD}Summary${RESET}`);
const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
const totalWarnings = results.reduce((sum, r) => sum + r.warnings, 0);
const totalInfos = results.reduce((sum, r) => sum + r.infos, 0);
const allPassed = results.every((r) => r.passed);

if (allPassed) {
  console.log(
    `${GREEN}All specs passed validation.${RESET} ${totalWarnings} warning(s), ${totalInfos} info(s)`,
  );
} else {
  console.log(
    `${RED}Validation failed: ${totalErrors} error(s)${RESET}, ${totalWarnings} warning(s), ${totalInfos} info(s)`,
  );
  console.log(`\nFailed files:`);
  results
    .filter((r) => !r.passed)
    .forEach((r) => {
      console.log(`  ${RED}${r.file}${RESET} — ${r.errors} error(s)`);
    });
}

process.exit(allPassed ? 0 : 1);
