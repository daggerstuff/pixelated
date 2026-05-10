#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const files = process.argv.slice(2).map((filePath) => filePath.trim());

const isGeneratedMarkdownFile = (filePath) => {
  const normalizedPath = filePath.replaceAll("\\", "/");
  return (
    normalizedPath.startsWith(".Jules/") &&
    /\.(md|mdx)$/.test(normalizedPath)
  );
};

const generatedFiles = files.filter(isGeneratedMarkdownFile);

if (generatedFiles.length === 0) {
  process.exit(0);
}

const runCommand = (args) => {
  const { status } = spawnSync("pnpm", args, {
    stdio: "inherit",
  });
  if (status !== 0) process.exit(status);
};

runCommand([
  "exec",
  "markdownlint",
  "--config",
  ".markdownlint.json",
  "--fix",
  ...generatedFiles,
]);

runCommand(["exec", "prettier", "--write", ...generatedFiles]);

