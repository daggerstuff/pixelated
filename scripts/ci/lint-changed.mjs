#!/usr/bin/env node
/// <reference types="node" />

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

/** @typedef {import('node:child_process').SpawnSyncReturns<string>} SpawnSyncTextResult */

const ALLOWED_EXTENSIONS_BY_MODE = {
  standard: new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts", ".astro"]),
  markdown: new Set([".md", ".mdx"]),
  imports: new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]),
  "unused-exports": new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]),
};

const DIFF_PATTERNS_BY_MODE = {
  standard: ["*.js", "*.jsx", "*.ts", "*.tsx", "*.mjs", "*.cjs", "*.mts", "*.cts", "*.astro"],
  markdown: ["*.md", "*.mdx"],
  imports: ["*.ts", "*.tsx", "*.js", "*.jsx", "*.mjs", "*.cjs", "*.mts", "*.cts"],
  "unused-exports": ["*.ts", "*.tsx", "*.js", "*.jsx", "*.mjs", "*.cjs", "*.mts", "*.cts"],
};

const args = process.argv.slice(2);
const isTypeAware = args.includes("--type-aware");
const isMarkdown = args.includes("--markdown");
const isImports = args.includes("--imports");
const isUnusedExports = args.includes("--unused-exports");

const conflictingFlags =
  [isTypeAware, isMarkdown, isImports, isUnusedExports].filter(Boolean).length > 1;
if (conflictingFlags) {
  console.error(
    "Error: --type-aware, --markdown, --imports, and --unused-exports are mutually exclusive.",
  );
  process.exit(2);
}

const mode = isUnusedExports
  ? "unused-exports"
  : isImports
    ? "imports"
    : isMarkdown
      ? "markdown"
      : "standard";
const allowedExtensions = ALLOWED_EXTENSIONS_BY_MODE[mode];
const diffPatterns = DIFF_PATTERNS_BY_MODE[mode];

/**
 * Resolve a tool to a direct executable so the runner never has to go through
 * pnpm, which reconciles the workspace as a side effect and rewrites
 * pnpm-lock.yaml when submodules are not initialized.
 *
 * @param {string} tool
 * @returns {{ command: string, prefix: string[] }}
 */
function resolveTool(tool) {
  const binPath = resolve("node_modules/.bin", tool);
  if (existsSync(binPath)) {
    return { command: binPath, prefix: [] };
  }
  return { command: "pnpm", prefix: ["exec", tool] };
}

/** @param {string[]} files */
/** @returns {{ command: string, args: string[] }} */
function getToolInvocation(files) {
  if (mode === "markdown") {
    const { command, prefix } = resolveTool("markdownlint");
    return {
      command,
      args: [...prefix, "--config", ".markdownlint.json", ...files.map(String)],
    };
  }

  const { command, prefix } = resolveTool("oxlint");
  return {
    command,
    args: [
      ...prefix,
      "-c",
      ".oxlintrc.json",
      ...(isTypeAware ? ["--type-aware"] : []),
      ...files.map(String),
    ],
  };
}

/** @returns {string} */
function logMode() {
  if (mode === "markdown") return `Running markdownlint on ${changedFiles.length} changed files`;
  if (mode === "imports") return `Checking imports on ${changedFiles.length} changed files`;
  if (mode === "unused-exports")
    return `Checking unused exports on ${changedFiles.length} changed files`;
  const lintMode = isTypeAware ? "type-aware" : "standard";
  return `Running oxlint (${lintMode}) on ${changedFiles.length} changed files`;
}

/** @param {string | undefined} range */
/** @returns {string[]} */
function runGitDiff(range) {
  const args = ["diff", "--name-only", "--diff-filter=ACMRTUXB", "--"];
  if (typeof range === "string") {
    args.splice(3, 0, range);
  }
  /** @type {SpawnSyncTextResult} */
  const result = spawnSync("git", [...args, ...diffPatterns], {
    encoding: "utf8",
  });
  const { status, stdout } = result;

  if (status !== 0 || !stdout) return [];

  return stdout
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => typeof line === "string" && line.length > 0);
}

/** @returns {string[]} */
function getCandidateFileDiffs() {
  const eventName = process.env.GITHUB_EVENT_NAME;
  const sha = process.env.GITHUB_SHA ?? "HEAD";
  const beforeSha = process.env.GITHUB_EVENT_BEFORE;
  const baseRef = process.env.GITHUB_BASE_REF;

  if (eventName === "pull_request" || eventName === "pull_request_target") {
    if (baseRef) {
      return runGitDiff(`origin/${baseRef}...${sha}`);
    }
  }

  if (beforeSha && !/0{40}/.test(beforeSha)) {
    return runGitDiff(`${beforeSha}...${sha}`);
  }

  const parentDiff = runGitDiff("HEAD~1...HEAD");
  if (parentDiff.length > 0) {
    return parentDiff;
  }

  const staged = runGitDiff("--cached");
  if (staged.length > 0) {
    return staged;
  }

  return runGitDiff();
}

/** @param {string} filePath */
/** @returns {boolean} */
function isLintableFile(filePath) {
  return (
    existsSync(String(filePath)) &&
    allowedExtensions.has(String(filePath).slice(String(filePath).lastIndexOf(".")))
  );
}

/** @param {string[]} files */
function runLint(files) {
  if (mode === "imports" || mode === "unused-exports") {
    const script =
      mode === "imports"
        ? "scripts/ci/check-unresolved-imports.mjs"
        : "scripts/ci/check-unused-exports.mjs";
    /** @type {SpawnSyncTextResult} */
    const result = spawnSync(process.execPath, [script, ...files], {
      stdio: "inherit",
    });
    const { status } = result;
    if (status !== 0) process.exit(status);
    return;
  }

  const { command, args } = getToolInvocation(files);

  /** @type {SpawnSyncTextResult} */
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe",
  });
  const { status, stdout, stderr } = result;
  const output = `${stdout ?? ""}${stderr ?? ""}`;

  // Write captured output so it still appears in CI logs.
  process.stdout.write(stdout ?? "");
  process.stderr.write(stderr ?? "");

  if (status !== 0) {
    // Oxlint exits 1 with a "No files found" message when every supplied file
    // is excluded by ignorePatterns. In CI that should not be a hard failure.
    if (
      output.includes("No files found to lint") &&
      output.includes("Please check your paths and ignore patterns")
    ) {
      console.log("All changed files are ignored by oxlint; skipping.");
      process.exit(0);
    }
    process.exit(status);
  }
}

function runFullLint() {
  const modeLabel = isMarkdown ? "markdown" : isTypeAware ? "type-aware" : "standard";
  console.log(
    `No changed files detected; falling back to full lint:ci baseline check (${modeLabel}).`,
  );

  /** @param {string} command @param {string[]} commandArgs */
  const run = (command, commandArgs) => {
    /** @type {SpawnSyncTextResult} */
    const result = spawnSync(command, commandArgs, { stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status ?? 1);
  };

  if (mode === "markdown") {
    const { command, prefix } = resolveTool("markdownlint");
    run(command, [
      ...prefix,
      "--config",
      ".markdownlint.json",
      "--ignore",
      "node_modules",
      "--ignore",
      "**/node_modules/**",
      "**/*.md",
      "**/*.mdx",
    ]);
    return;
  }

  if (mode === "imports") {
    run(process.execPath, ["scripts/ci/check-unresolved-imports.mjs"]);
    return;
  }

  if (mode === "unused-exports") {
    run(process.execPath, ["scripts/ci/check-unused-exports.mjs"]);
    return;
  }

  run("bash", ["scripts/ci/lint-chunked.sh"]);
  run("bash", ["scripts/ci/check-no-suppressions.sh"]);
}

const changedFiles = getCandidateFileDiffs()
  .map((filePath) => filePath.trim())
  .filter(isLintableFile);

if (changedFiles.length === 0) {
  if (process.env.GITHUB_ACTIONS === "true") {
    const modeLabel = isMarkdown ? "markdown" : isTypeAware ? "type-aware" : "standard";
    console.log(
      `No changed files detected for lint:ci (${modeLabel}); skipping lint checks in CI.`,
    );
    process.exit(0);
  }
  runFullLint();
  process.exit(0);
}

console.log(logMode());
runLint(changedFiles);
