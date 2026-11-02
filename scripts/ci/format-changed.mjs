#!/usr/bin/env node
/// <reference types="node" />
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

/** @typedef {import('child_process').SpawnSyncReturns<string>} SpawnSyncTextResult */

/**
 * oxfmt's scope — including which files it must not touch — is defined in
 * `.oxfmtrc.jsonc` (`ignorePatterns`) plus `.gitignore`, and nowhere else.
 *
 * Do not reintroduce a per-file exclusion list here. The pre-commit hook runs
 * oxfmt over staged files with the same flags, so a list that only existed in
 * this script made the hook format files CI never checked.
 */
const OXFMT_ARGS = ["--ignore-path", ".gitignore"];

// Mirrors the oxfmt glob in `.lintstagedrc.json` exactly, so every extension
// the hook formats is also checked here.
const OXFMT_APPLICABLE_EXTENSIONS = new Set([
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
]);

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
  const result = spawnSync("pnpm", ["--silent", command, ...args], {
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

// oxfmt is the sole formatter for JS/TS code. Running prettier over the same
// files caused formatter fights (the two disagree on union-type splitting and
// other constructs), so prettier is used ONLY for .astro, which oxfmt cannot
// format.
const ASTRO_FILES = changedFiles.filter((filePath) =>
  filePath.endsWith(".astro"),
);

if (ASTRO_FILES.length > 0) {
  runCommand("prettier", ["--check", ...ASTRO_FILES]);
}

const oxfmtFiles = changedFiles.filter((filePath) => {
  const extension = filePath.slice(filePath.lastIndexOf("."));
  return OXFMT_APPLICABLE_EXTENSIONS.has(extension);
});

if (oxfmtFiles.length > 0) {
  runCommand("oxfmt", [
    "--check",
    ...OXFMT_ARGS,
    "--no-error-on-unmatched-pattern",
    ...oxfmtFiles,
  ]);
}
