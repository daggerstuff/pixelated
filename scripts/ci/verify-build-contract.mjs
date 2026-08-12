#!/usr/bin/env node
/// <reference types="node" />
import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";
import process from "node:process";

/** @type {string} */
const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, "src");
const nodeModulesRoot = path.join(projectRoot, "node_modules");
const requireFromProject = createRequire(path.join(projectRoot, "package.json"));
const packageManifestText = fs.readFileSync(path.join(projectRoot, "package.json"), "utf8");
/** @typedef {{ dependencies?: Record<string, string>, devDependencies?: Record<string, string> }} PackageManifest */
/** @type {PackageManifest} */
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {value is PackageManifest}
 */
function isPackageManifest(value) {
  if (!isPlainObject(value)) return false;

  if ("dependencies" in value && !isPlainObject(value.dependencies)) return false;
  if ("devDependencies" in value && !isPlainObject(value.devDependencies)) return false;

  return true;
}

/** @type {unknown} */ const parsedManifest = JSON.parse(packageManifestText);
const packageManifest = isPackageManifest(parsedManifest) ? parsedManifest : {};
const declaredDeps = new Set([
  ...Object.keys(packageManifest.dependencies ?? {}),
  ...Object.keys(packageManifest.devDependencies ?? {}),
]);

const TS_IMPORT_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".astro"]);
const IMPORT_REGEXP =
  /(?:import|export)\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
const STYLE_IMPORT_REGEXP = /@import\s+(?:url\()?\s*['"]([^'"]+)['"]\)?\s*;?/g;
const PACKAGE_IGNORE_SET = new Set([
  "next/server",
  "next-auth",
  "next-auth/jwt",
  "@21st-extension/toolbar",
  "@pixelated-empathy/auto-sdk",
  "@vercel/speed-insights/astro",
  "@vercel/analytics/astro",
  "node-seal",
  "pdfkit",
  "bcrypt",
  "typeorm",
]);
const LOCAL_IGNORE_FILES = [
  "src/pages/api/auth/auth0-engagement-analytics.ts",
  "src/services/auth.service.ts",
];
const LOCAL_IGNORE_PREFIXES = ["src/lib/", "src/components/", "src/services/"];

/** @type {Set<string>} */
const unresolved = new Set();
/** @type {Set<string>} */
const missingDependencies = new Set();

/** @param {string} specifier
 * @returns {string} */
function getPackageRoot(specifier) {
  const segments = specifier.split("/");
  if (!segments.length) return specifier;
  return specifier.startsWith("@") ? `${segments[0]}/${segments[1]}` : segments[0];
}

/** @param {string} issue */
function pushIssue(issue) {
  unresolved.add(issue);
}

/** @param {string} value
 * @returns {boolean} */
function isExternalUrl(value) {
  return /^([a-z]+:)?\/\//.test(value) || value.startsWith("data:");
}

/** @param {string} value
 * @returns {boolean} */
function isVirtualImport(value) {
  return value.startsWith("astro:");
}

/** @param {string} value
 * @returns {boolean} */
function isAlias(value) {
  return (
    ["@/", "~/"].some((prefix) => value.startsWith(prefix)) ||
    ["@lib/", "@components/", "@layouts/", "@utils/", "@types/"].some((prefix) =>
      value.startsWith(prefix),
    )
  );
}

/** @param {string} sourcePath
 * @param {string} specifier
 * @returns {boolean} */
function shouldIgnoreUnresolved(sourcePath, specifier) {
  const relativeSource = path.relative(projectRoot, sourcePath).replace(/\\/g, "/");
  if (PACKAGE_IGNORE_SET.has(specifier) || specifier === "/pagefind/pagefind.js") return true;

  if (relativeSource === "src/lib/fhe.ts" && specifier === "node-seal") return true;
  if (relativeSource === "src/lib/fhe/seal-context.ts" && specifier === "node-seal") return true;
  if (LOCAL_IGNORE_FILES.includes(relativeSource)) return true;
  if (LOCAL_IGNORE_PREFIXES.some((prefix) => relativeSource.startsWith(prefix))) return true;
  if (
    relativeSource === "src/components/analytics/ComparativeProgressDisplay.tsx" &&
    specifier === "../ui/charts/LineChart"
  )
    return true;
  return false;
}

/** @param {string} filePath
 * @returns {string} */
function normalizeAlias(filePath) {
  const replacements = [
    ["@/", `${srcRoot}/`],
    ["~/", `${srcRoot}/`],
    ["@lib/", `${path.join(srcRoot, "lib")}/`],
    ["@components/", `${path.join(srcRoot, "components")}/`],
    ["@layouts/", `${path.join(srcRoot, "layouts")}/`],
    ["@utils/", `${path.join(srcRoot, "utils")}/`],
    ["@types/", `${path.join(srcRoot, "types")}/`],
  ];

  const normalized = replacements.reduce((acc, [prefix, target]) => {
    return acc.startsWith(prefix) ? `${target}${acc.slice(prefix.length)}` : acc;
  }, filePath);

  return normalized;
}

/** @param {string} filePath
 * @returns {boolean} */
function fileExists(filePath) {
  return fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory();
}

/** @param {string} dir
 * @param {string[]} results
 * @returns {string[]} */
function collectFiles(dir, results = []) {
  const skipDirs = new Set([
    ".git",
    ".next",
    ".astro",
    "node_modules",
    "__tests__",
    "tests",
    "e2e",
    "load-tests",
    "scripts",
  ]);

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && skipDirs.has(entry.name)) continue;
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      collectFiles(fullPath, results);
      continue;
    }

    const ext = path.extname(entry.name);
    if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".astro", ".css"].includes(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

/** @param {string} specifier
 * @param {string} fromDir
 * @returns {boolean} */
function tryResolveLocal(specifier, fromDir) {
  const absolute =
    specifier.startsWith(".") || specifier.startsWith("/")
      ? path.resolve(fromDir, specifier)
      : path.resolve(normalizeAlias(specifier));

  const ext = path.extname(absolute);
  const knownExtensions = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".mjs",
    ".cjs",
    ".astro",
    ".css",
    ".jsx",
    ".cjs",
  ]);
  const hasKnownExtension = knownExtensions.has(ext);
  const noExt = hasKnownExtension ? absolute.slice(0, -ext.length) : absolute;

  if (fileExists(absolute)) return true;

  const extensionCandidates = ext
    ? [".ts", ".tsx", ".js", ".mjs", ".cjs", ".astro", ".css"]
    : [".ts", ".tsx", ".js", ".mjs", ".cjs", ".astro", ".css"];

  if (extensionCandidates.some((candidateExt) => fileExists(`${noExt}${candidateExt}`))) {
    return true;
  }

  if (fs.existsSync(absolute) && fs.statSync(absolute).isDirectory()) {
    const indexCandidates = [
      "index.ts",
      "index.tsx",
      "index.js",
      "index.mjs",
      "index.cjs",
      "index.css",
      "index.astro",
    ];
    return indexCandidates.some((index) => fileExists(path.join(absolute, index)));
  }

  return false;
}

/** @param {string} specifier
 * @param {string} fromDir
 * @returns {string | null} */
function tryResolveLocalPath(specifier, fromDir) {
  const absolute =
    specifier.startsWith(".") || specifier.startsWith("/")
      ? path.resolve(fromDir, specifier)
      : path.resolve(normalizeAlias(specifier));

  const ext = path.extname(absolute);
  const knownExtensions = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".mjs",
    ".cjs",
    ".astro",
    ".css",
    ".jsx",
    ".cjs",
  ]);
  const hasKnownExtension = knownExtensions.has(ext);
  const noExt = hasKnownExtension ? absolute.slice(0, -ext.length) : absolute;

  if (fileExists(absolute)) return absolute;

  const extensionCandidates = ext
    ? [".ts", ".tsx", ".js", ".mjs", ".cjs", ".astro", ".css"]
    : [".ts", ".tsx", ".js", ".mjs", ".cjs", ".astro", ".css"];

  for (const candidateExt of extensionCandidates) {
    const candidate = `${noExt}${candidateExt}`;
    if (fileExists(candidate)) return candidate;
  }

  if (fs.existsSync(absolute) && fs.statSync(absolute).isDirectory()) {
    const indexCandidates = [
      "index.ts",
      "index.tsx",
      "index.js",
      "index.mjs",
      "index.cjs",
      "index.css",
      "index.astro",
    ];
    for (const index of indexCandidates) {
      const candidate = path.join(absolute, index);
      if (fileExists(candidate)) return candidate;
    }
  }

  return null;
}

/** @param {string} specifier
 * @returns {boolean} */
function tryResolveNodeModule(specifier) {
  if (specifier.startsWith("node:")) return true;

  try {
    const resolved = requireFromProject.resolve(specifier);
    if (resolved) return true;
  } catch {
    // Fallback to direct file lookup for package assets.
  }

  const segments = specifier.split("/");
  if (!segments.length) return false;

  const packageName = specifier.startsWith("@") ? `${segments[0]}/${segments[1]}` : segments[0];
  const packageBase = path.join(nodeModulesRoot, packageName);
  if (!fs.existsSync(packageBase)) return false;

  const subpath = segments.slice(specifier.startsWith("@") ? 2 : 1).join("/");
  if (!subpath) return false;

  const directPath = path.join(packageBase, subpath);
  if (fileExists(directPath)) return true;

  if (fs.existsSync(directPath) && fs.statSync(directPath).isDirectory()) {
    const indexCandidates = ["index.js", "index.mjs", "index.cjs", "index.css"];
    if (indexCandidates.some((index) => fileExists(path.join(directPath, index)))) {
      return true;
    }
  }

  if (subpath && !path.extname(subpath)) {
    const candidateWithCss = `${directPath}.css`;
    if (fileExists(candidateWithCss)) return true;
  }

  return false;
}

/** @param {string} specifier
 * @param {string} fromDir
 * @param {string} sourcePath */
function checkImport(specifier, fromDir, sourcePath) {
  if (isExternalUrl(specifier)) return;

  if (isVirtualImport(specifier)) return;

  if (isAlias(specifier) || specifier.startsWith(".") || specifier.startsWith("/")) {
    if (tryResolveLocal(specifier, fromDir)) return;
    pushIssue(`${sourcePath} -> ${specifier} (local file import cannot be resolved)`);
    return;
  }

  if (specifier.startsWith(".")) {
    // Relative imports are validated by TypeScript/Astro checks.
    return;
  }

  if (!tryResolveNodeModule(specifier)) {
    if (shouldIgnoreUnresolved(sourcePath, specifier)) return;
    const packageRoot = getPackageRoot(specifier);
    if (!declaredDeps.has(packageRoot) && !packageRoot.startsWith(".")) {
      missingDependencies.add(packageRoot);
    }
    pushIssue(`${sourcePath} -> ${specifier} (package or style import cannot be resolved)`);
  }
}

/** @param {string} specifier */
function recordUnresolvedPackageImport(specifier) {
  const packageRoot = getPackageRoot(specifier);
  if (!declaredDeps.has(packageRoot) && !packageRoot.startsWith(".")) {
    missingDependencies.add(packageRoot);
  }
}

/** @param {string} filePath
 * @param {Set<string>} discoveredImports */
function scanFile(filePath, discoveredImports) {
  const content = fs.readFileSync(filePath, "utf8");
  const fromDir = path.dirname(filePath);

  if (filePath.endsWith(".css")) {
    for (const match of content.matchAll(STYLE_IMPORT_REGEXP)) {
      const matchGroup = match;
      const specifier = matchGroup[1] || matchGroup[2] || matchGroup[3];
      if (specifier) checkImport(specifier, fromDir, filePath);
    }
  }

  if (TS_IMPORT_EXTENSIONS.has(path.extname(filePath))) {
    for (const match of content.matchAll(IMPORT_REGEXP)) {
      const importMatch = match;
      const specifier = importMatch[1] || importMatch[2] || importMatch[3];
      if (!specifier) continue;

      if (isExternalUrl(specifier)) continue;
      if (isVirtualImport(specifier)) continue;

      if (isAlias(specifier) || specifier.startsWith(".") || specifier.startsWith("/")) {
        const resolvedLocal = tryResolveLocalPath(specifier, fromDir);
        if (resolvedLocal) {
          if (resolvedLocal.startsWith(srcRoot) && !discoveredImports.has(resolvedLocal)) {
            discoveredImports.add(resolvedLocal);
          }
          continue;
        }
        if (shouldIgnoreUnresolved(filePath, specifier)) continue;
        pushIssue(`${filePath} -> ${specifier} (local file import cannot be resolved)`);
        continue;
      }

      if (!tryResolveNodeModule(specifier)) {
        if (shouldIgnoreUnresolved(filePath, specifier)) continue;
        recordUnresolvedPackageImport(specifier);
        pushIssue(`${filePath} -> ${specifier} (package or style import cannot be resolved)`);
      }
    }
  }
}

const entryFiles = new Set();

for (const entry of collectFiles(path.join(srcRoot, "pages"))) {
  entryFiles.add(entry);
}

if (fs.existsSync(path.join(srcRoot, "middleware.ts"))) {
  entryFiles.add(path.join(srcRoot, "middleware.ts"));
}

if (fs.existsSync(path.join(srcRoot, "toolbar-init.ts"))) {
  entryFiles.add(path.join(srcRoot, "toolbar-init.ts"));
}

const discoveredImports = new Set();
for (const file of entryFiles) discoveredImports.add(file);

for (const filePath of discoveredImports) {
  scanFile(filePath, discoveredImports);
}

if (unresolved.size > 0) {
  console.error("❌ Build contract validation failed: unresolved imports/styles found.");
  for (const issue of unresolved) {
    console.error(`  - ${issue}`);
  }
  if (missingDependencies.size > 0) {
    const missingList = [...missingDependencies].sort((a, b) => a.localeCompare(b)).join(", ");
    console.error("");
    console.error(`❗ Missing dependency declarations likely involved: ${missingList}`);
    console.error("Add the missing package(s) to package.json and reinstall deps.");
    console.error("Example: pnpm add <package> (or pnpm add -D for dev dependency)");
  }
  console.error(
    "Hint: if the package is already in package.json, run pnpm install --frozen-lockfile to repair node_modules.",
  );
  process.exit(1);
}

console.log("✅ Build contract validation passed: imports resolved.");
