#!/usr/bin/env node

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const ALLOWED_EXTENSIONS_BY_MODE = {
  standard: new Set([
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".mjs",
    ".cjs",
    ".mts",
    ".cts",
    ".astro",
  ]),
  markdown: new Set([".md", ".mdx"]),
};

const DIFF_PATTERNS_BY_MODE = {
  standard: [
    "*.js",
    "*.jsx",
    "*.ts",
    "*.tsx",
    "*.mjs",
    "*.cjs",
    "*.mts",
    "*.cts",
    "*.astro",
  ],
  markdown: ["*.md", "*.mdx"],
};

const args = process.argv.slice(2);
const isTypeAware = args.includes("--type-aware");
const isMarkdown = args.includes("--markdown");

if (isTypeAware && isMarkdown) {
  console.error(
    "Invalid lint mode: --type-aware and --markdown cannot be combined.",
  );
  process.exit(2);
}

const mode = isMarkdown ? "markdown" : "standard";
const allowedExtensions = ALLOWED_EXTENSIONS_BY_MODE[mode];
const diffPatterns = DIFF_PATTERNS_BY_MODE[mode];

function getAllLintCommand() {
  if (mode === "markdown") return "lint:markdown:ci:all";
  return isTypeAware ? "lint:ci:type-aware:all" : "lint:ci:all";
}

function getLintArgs(files) {
  if (mode === "markdown") {
    return [
      "exec",
      "markdownlint",
      "--config",
      ".markdownlint.json",
      ...files,
    ].filter(Boolean);
  }

  return [
    "exec",
    "oxlint",
    ...(isTypeAware ? ["--type-aware"] : []),
    "-c",
    ".oxlintrc.json",
    ...files,
  ].filter(Boolean);
}

function logMode() {
  if (mode === "markdown") return `Running markdownlint on ${changedFiles.length} changed files`;
  const lintMode = isTypeAware ? "type-aware" : "standard";
  return `Running oxlint (${lintMode}) on ${changedFiles.length} changed files`;
}

function runGitDiff(range) {
  const args = ["diff", "--name-only", "--diff-filter=ACMRTUXB", "--"];
  if (range) {
    args.splice(3, 0, range);
  }
  const { status, stdout } = spawnSync("git", [...args, ...diffPatterns], {
    encoding: "utf8",
  });

  if (status !== 0 || !stdout) return [];

  return stdout
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getCandidateFileDiffs() {
  const eventName = process.env.GITHUB_EVENT_NAME;
  const sha = process.env.GITHUB_SHA || "HEAD";
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

function isLintableFile(filePath) {
  return (
    existsSync(filePath) &&
    allowedExtensions.has(filePath.slice(filePath.lastIndexOf(".")))
  );
}

function runLint(files) {
  const { status } = spawnSync("pnpm", getLintArgs(files), {
    stdio: "inherit",
  });
  if (status !== 0) process.exit(status);
}

function runFullLint() {
  const modeLabel = isMarkdown ? "markdown" : isTypeAware ? "type-aware" : "standard";
  console.log(
    `No changed files detected; falling back to full lint:ci baseline check (${modeLabel}).`,
  );
  const { status } = spawnSync("pnpm", ["run", getAllLintCommand()], {
    stdio: "inherit",
  });
  if (status !== 0) process.exit(status);
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

