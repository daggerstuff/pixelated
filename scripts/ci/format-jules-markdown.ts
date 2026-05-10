#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const files: string[] = process.argv.slice(2).map((filePath: string) => filePath.trim());

const isGeneratedMarkdownFile = (filePath: string): boolean => {
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

const runCommand = (args: string[]): void => {
  const result = spawnSync("pnpm", args, {
    stdio: "inherit",
  });
  const status = result.status;
  if (status === null || status !== 0) {
    process.exit(status ?? 1);
  }
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

