#!/usr/bin/env node

import { scanDirectory } from "./security-audit.js";

console.log("🔍 Running pre-commit security check...");

const results = scanDirectory("src");

if (results.length > 0) {
  console.error("❌ Security check failed!");
  console.error("Found the following security issues:");

  results.forEach(({ file, line, message, code }) => {
    console.error(`  ${file}:${line} - ${message}`);
    console.error(`    ${code}`);
  });

  console.error("\nPlease fix these security issues before committing.");
  process.exit(1);
}

console.log("✅ Security check passed!");
