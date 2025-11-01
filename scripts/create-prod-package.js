#!/usr/bin/env node

/**
 * Create a production package.json by filtering out dev dependencies
 * This script is used in Docker builds to create a minimal production package
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the original package.json
const packagePath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Create production package.json (include all dependencies to match lockfile)
const prodPackage = {
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,
  main: packageJson.main,
  scripts: {
    start: 'node ./dist/server/entry.mjs'
  },
  dependencies: packageJson.dependencies || {},
  devDependencies: packageJson.devDependencies || {},
  engines: packageJson.engines,
  private: packageJson.private,
  overrides: packageJson.overrides || {},
  pnpm: packageJson.pnpm || {}
};

// Write the production package.json
fs.writeFileSync('package.prod.json', JSON.stringify(prodPackage, null, 2));

console.log('Production package.json created successfully');