#!/usr/bin/env node
/// <reference types="node" />

import { spawnSync } from "child_process";
import { argv, exit } from "process";

const files: string[] = argv.slice(2).map((filePath: string) => filePath.trim());

const isGeneratedMarkdownFile = (filePath: string): boolean => {
  const normalizedPath = filePath.replaceAll("\\", "/");
  return (
    normalizedPath.startsWith(".Jules/") &&
    /\.(md|mdx)$/.test(normalizedPath)
  );
};

const generatedFiles = files.filter(isGeneratedMarkdownFile);

if (generatedFiles.length === 0) {
  exit(0);
}

const runCommand = (args: string[]): void => {
  const result = spawnSync("pnpm", args, {
    stdio: "inherit",
  });
  const status = result.status;
  if (status === null || status !== 0) {
    exit(status ?? 1);
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

