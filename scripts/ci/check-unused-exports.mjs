#!/usr/bin/env node
/**
 * Check for unused exports in source files.
 *
 * Three modes:
 *
 *   1. Full Knip scan (default, no flags):
 *      Runs Knip across the entire project for comprehensive analysis.
 *      Used in CI via pnpm lint:unused-exports.
 *
 *   2. Index-based changed-files scan (--changed-files <files...>):
 *      Uses a precomputed export-usage index (.cache/knip-index.json) to
 *      check whether each export from the given files has any import consumers.
 *      ~instant (index read + lookup).  Used in pre-commit hooks.
 *      Falls back to building the index on-the-fly if none exists.
 *
 *   3. Index builder (--build-index):
 *      Scans all source files and builds the export-usage index.
 *      Run this after major refactors or when you want fresh data.
 *      Also triggered automatically on first --changed-files use.
 *
 * The index maps: filePath -> { exportName -> { line, col, kind, importedBy[] } }
 *
 * Why an index instead of always running Knip?
 *   Knip is a full dependency-graph analysis (~6s even for small changes).
 *   For pre-commit hooks, we want sub-second feedback.  The index trades
 *   perfect accuracy (Knip) for speed, catching the obvious cases (exports
 *   that have zero import consumers anywhere in the project).
 */

import { spawn } from "node:child_process";
import { accessSync, constants, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import { glob } from "glob";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INDEX_PATH = resolve(".cache/knip-index.json");
const INDEX_VERSION = 3;
const SCAN_GLOB = "{apps/web/src,apps/business-strategy-cms/src}/**/*.{ts,tsx,js,jsx,astro}";
const SCAN_IGNORE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.astro/**",
  "**/*.test.{ts,tsx,js,jsx}",
  "**/*.spec.{ts,tsx,js,jsx}",
  "**/*.generated.*",
  "**/*.d.ts",
  "apps/web/src/lib/governance/policy-engine.ts",
  "apps/web/src/lib/middleware/csrf.ts",
  "apps/web/src/lib/research/services/*.ts",
  "apps/web/src/lib/ai/bias-detection/BiasDetectionEngine.ts",
  "apps/web/src/lib/ai/services/*.ts",
  "apps/web/src/lib/crypto.ts",
  "apps/web/src/lib/fhe/fhe-service.ts",
  "apps/web/src/lib/redis.ts",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalise(p) {
  return resolve(p).replace(/\\/g, "/");
}

function pathExists(filePath) {
  try {
    accessSync(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

const RESOLVE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"];
const INDEX_FILES = RESOLVE_EXTENSIONS.map((ext) => "/index" + ext);

// ---------------------------------------------------------------------------
// Alias resolution (from tsconfig paths)
// ---------------------------------------------------------------------------

const ALIAS_PATTERNS = loadAliasPatterns();

function loadAliasPatterns() {
  const tsconfigPath = resolve("tsconfig.json");
  if (!pathExists(tsconfigPath)) return [];

  let raw;
  try {
    raw = readFileSync(tsconfigPath, "utf8");
  } catch {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const paths = parsed?.compilerOptions?.paths;
  if (!paths || typeof paths !== "object") return [];

  const cwd = resolve(".");

  return Object.entries(paths).map(([pattern, targets]) => {
    const target = Array.isArray(targets) ? targets[0] : targets;
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regexPattern = escaped.replace(/\\\*/g, "(.*)");
    return {
      regex: new RegExp("^" + regexPattern + "$"),
      target: resolve(cwd, target.replace(/\/$/, "")),
      base: target.replace(/\/\*$/, "").replace(/\/$/, ""),
    };
  });
}

function resolveWithExtensions(filePath) {
  // Exact match
  if (pathExists(filePath)) return filePath;

  // .js/.jsx -> .ts/.tsx (TypeScript ESM convention)
  if (filePath.endsWith(".js")) {
    const without = filePath.slice(0, -3);
    if (pathExists(without + ".ts")) return without + ".ts";
    if (pathExists(without + ".tsx")) return without + ".tsx";
  }
  if (filePath.endsWith(".jsx")) {
    const without = filePath.slice(0, -4);
    if (pathExists(without + ".tsx")) return without + ".tsx";
  }

  // Try appending extensions
  for (const ext of RESOLVE_EXTENSIONS) {
    if (pathExists(filePath + ext)) return filePath + ext;
  }

  // Try index files
  for (const idx of INDEX_FILES) {
    if (pathExists(filePath + idx)) return filePath + idx;
  }

  return null;
}

/**
 * Resolve an import source to an actual file path.
 * Mirrors the logic in check-unresolved-imports.mjs and supports tsconfig paths aliases.
 */
function resolveImport(importSource, fileDir) {
  // Try tsconfig alias resolution first (e.g. '@/lib/encryption' -> './apps/web/src/lib/encryption')
  for (const alias of ALIAS_PATTERNS) {
    const match = importSource.match(alias.regex);
    if (!match) continue;
    const suffix = match[1] || "";
    const candidate = resolve(alias.target.replace(/\/\*$/, ""), suffix);
    const resolved = resolveWithExtensions(candidate);
    if (resolved) return resolved;
  }

  if (!isRelativePath(importSource)) return null;

  const resolvedPath = resolve(fileDir, importSource);
  return resolveWithExtensions(resolvedPath);
}

function isRelativePath(p) {
  return p.startsWith("./") || p.startsWith("../");
}

function stripComments(source) {
  let result = source.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "));
  result = result.replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
  return result;
}

// ---------------------------------------------------------------------------
// Index: regex-based export & import extraction
// ---------------------------------------------------------------------------

/**
 * Extract export names from source code.
 * Returns array of { name, line, col, kind }.
 */
function extractExports(source, cleanSource) {
  const exports = [];
  const lines = source.split("\n");
  const cleanLines = cleanSource.split("\n");

  // Build a mapping from cleanLine -> realLine (in case we need line info)
  // Actually, we can compute line from the match index in source vs cleanSource.
  // For simplicity, scan cleanSource for export patterns:

  // export const/function/class/interface/type/enum/let/var Name
  const exportDeclRe =
    /export\s+(?:default\s+)?(?:const|function|class|interface|type|enum|let|var)\s+(\w+)/g;
  let m;
  while ((m = exportDeclRe.exec(cleanSource)) !== null) {
    const line = countLines(cleanSource, m.index);
    const col = m.index - cleanSource.lastIndexOf("\n", m.index - 1) - 1;
    const kind = m[0].includes("interface")
      ? "type"
      : m[0].includes("type ")
        ? "type"
        : m[0].includes("enum ")
          ? "enum member"
          : m[0].includes("default")
            ? "export"
            : "export";
    exports.push({ name: m[1], line, col, kind });
  }

  // export default Identifier (re-exporting a previously defined symbol, common in React)
  // Must NOT be followed by a declaration keyword, to avoid double-counting.
  const exportDefaultRe = /export\s+default\s+(\w+)\s*;?$/gm;
  while ((m = exportDefaultRe.exec(cleanSource)) !== null) {
    // Skip if this export was already captured by exportDeclRe (e.g., export default function X)
    const line = countLines(cleanSource, m.index);
    const col = m.index - cleanSource.lastIndexOf("\n", m.index - 1) - 1;
    // Avoid duplicates: only add if this name is not already in exports
    const alreadyExists = exports.some((e) => e.name === m[1] && Math.abs(e.line - line) < 2);
    if (!alreadyExists) {
      exports.push({ name: m[1], line, col, kind: "export" });
    }
  }

  // export { Name1, Name2 as Alias }
  const exportNamedRe = /export\s+\{([^}]+)\}(?:\s+from\s+['"][^'"]+['"])?/g;
  while ((m = exportNamedRe.exec(cleanSource)) !== null) {
    const list = m[1]
      .split(",")
      .map((s) => {
        const parts = s.trim().split(/\s+as\s+/);
        return parts[0].trim();
      })
      .filter(Boolean);
    const line = countLines(cleanSource, m.index);
    const col = m.index - cleanSource.lastIndexOf("\n", m.index - 1) - 1;
    for (const name of list) {
      exports.push({ name, line, col, kind: "export" });
    }
  }

  return exports;
}

function countLines(text, pos) {
  let count = 1;
  for (let i = 0; i < pos && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) count++;
  }
  return count;
}

/**
 * Extract import statements from source code.
 * Returns array of { names: string[], source: string, line }.
 */
function extractImports(cleanSource) {
  const imports = [];

  // import { Name1, Name2 as Alias } from './path'
  const importNamedRe = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = importNamedRe.exec(cleanSource)) !== null) {
    const names = m[1]
      .split(",")
      .map((s) => {
        const parts = s.trim().split(/\s+as\s+/);
        return parts[0].trim();
      })
      .filter(Boolean);
    imports.push({ names, source: m[2], line: countLines(cleanSource, m.index) });
  }

  // import DefaultName from './path'
  const importDefaultRe = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
  while ((m = importDefaultRe.exec(cleanSource)) !== null) {
    imports.push({ names: [m[1]], source: m[2], line: countLines(cleanSource, m.index) });
  }

  // import * as Namespace from './path'
  const importNamespaceRe = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
  while ((m = importNamespaceRe.exec(cleanSource)) !== null) {
    imports.push({ names: [m[1]], source: m[2], line: countLines(cleanSource, m.index) });
  }

  // Dynamic imports: import('...') with member access like module.Name
  const importMemberAccess = new Set();
  const dynamicImportRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const moduleMemberRe = /module\.([A-Za-z_$][A-Za-z0-9_$]*)/g;

  /** @type {{ source: string; index: number }[]} */
  const dynamicImports = [];
  while ((m = dynamicImportRe.exec(cleanSource)) !== null) {
    dynamicImports.push({ source: m[1], index: m.index });
  }

  // For each dynamic import, capture member accesses on the module binding in the
  // same top-level/async scope (approximated by the nearest closing brace after
  // the import or end of file). This is conservative: it may over-count, but it
  // prevents false positives for lazy-loaded components.
  const findScopeEnd = (fromIndex) => {
    let braceCount = 0;
    let inString = null;
    for (let i = fromIndex; i < cleanSource.length; i++) {
      const ch = cleanSource[i];
      const prev = cleanSource[i - 1];
      if (inString) {
        if (ch === inString && prev !== "\\") inString = null;
      } else if (ch === '"' || ch === "'" || ch === "`") {
        inString = ch;
      } else if (ch === "{") {
        braceCount++;
      } else if (ch === "}") {
        if (braceCount <= 1) return i;
        braceCount--;
      }
    }
    return cleanSource.length;
  };

  for (const di of dynamicImports) {
    const scopeEnd = findScopeEnd(di.index);
    const slice = cleanSource.slice(di.index, scopeEnd);
    const localMembers = new Set();
    let mm;
    while ((mm = moduleMemberRe.exec(slice)) !== null) {
      localMembers.add(mm[1]);
    }
    if (localMembers.size > 0) {
      imports.push({
        names: [...localMembers],
        source: di.source,
        line: countLines(cleanSource, di.index),
      });
    }
  }

  return imports;
}

// ---------------------------------------------------------------------------
// Index builder
// ---------------------------------------------------------------------------

async function buildIndex() {
  console.log("Building export-usage index...");

  const files = await glob(SCAN_GLOB, { ignore: SCAN_IGNORE });

  /** @type {Map<string, { name: string, line: number, col: number, kind: string }[]>} */
  const fileExports = new Map();
  /** @type {Map<string, string>} */
  const fileToDir = new Map();
  /** @type {Map<string, string>} */
  const canonicalPath = new Map();

  // Phase 1: extract exports from every file
  for (const file of files) {
    const absPath = resolve(file);
    canonicalPath.set(absPath, absPath);
    fileToDir.set(absPath, dirname(absPath));

    const source = await readFile(absPath, "utf8");
    const cleanSource = stripComments(source);
    const exports = extractExports(source, cleanSource);
    if (exports.length > 0) {
      fileExports.set(absPath, exports);
    }
  }

  // Phase 2: extract imports from every file and cross-reference
  /** @type {Map<string, Map<string, Set<string>>>} */
  // file -> exportName -> Set<consumerFilePath>
  const usage = new Map();

  for (const file of files) {
    const absPath = resolve(file);
    const source = await readFile(absPath, "utf8");
    const cleanSource = stripComments(source);
    const imports = extractImports(cleanSource);

    for (const imp of imports) {
      const isAlias = ALIAS_PATTERNS.some((a) => a.regex.test(imp.source));
      if (!isRelativePath(imp.source) && !isAlias) continue;

      const resolvedTarget = resolveImport(imp.source, dirname(absPath));
      if (!resolvedTarget) continue;

      // For each imported name, check if the target file exports it
      for (const importedName of imp.names) {
        const targetExports = fileExports.get(resolvedTarget);
        if (!targetExports) continue;

        const hasExport = targetExports.some((e) => e.name === importedName);
        if (hasExport) {
          if (!usage.has(resolvedTarget)) usage.set(resolvedTarget, new Map());
          const exportMap = usage.get(resolvedTarget);
          if (!exportMap.has(importedName)) exportMap.set(importedName, new Set());
          exportMap.get(importedName).add(absPath);
        }
      }
    }
  }

  // Phase 3: build the index object
  /** @type {Record<string, Record<string, { line: number, col: number, kind: string, importedBy: string[] }>>} */
  const indexData = {};

  for (const [filePath, exports] of fileExports) {
    const relPath = relative(resolve("."), filePath);
    const fileUsage = usage.get(filePath);
    /** @type {Record<string, { line: number, col: number, kind: string, importedBy: string[] }>} */
    const exportMap = {};

    for (const exp of exports) {
      const consumers = fileUsage ? fileUsage.get(exp.name) : undefined;
      exportMap[exp.name] = {
        line: exp.line,
        col: exp.col,
        kind: exp.kind,
        importedBy: consumers ? [...consumers].map((p) => relative(resolve("."), p)).sort() : [],
      };
    }

    indexData[relPath] = exportMap;
  }

  // Write index
  mkdirSync(dirname(INDEX_PATH), { recursive: true });
  writeFileSync(
    INDEX_PATH,
    JSON.stringify(
      {
        version: INDEX_VERSION,
        files: indexData,
      },
      null,
      2,
    ),
  );

  const fileCount = Object.keys(indexData).length;
  const exportCount = Object.values(indexData).reduce((sum, m) => sum + Object.keys(m).length, 0);
  console.log("Index built: " + fileCount + " files, " + exportCount + " exports tracked.");
  return indexData;
}

// ---------------------------------------------------------------------------
// Index reader
// ---------------------------------------------------------------------------

function loadIndex() {
  if (!pathExists(INDEX_PATH)) return null;
  try {
    const data = JSON.parse(readFileSync(INDEX_PATH, "utf8"));
    if (data.version !== INDEX_VERSION) return null;
    return data.files;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Knip runner (full scan)
// ---------------------------------------------------------------------------

function runKnip() {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    const proc = spawn(
      "pnpm",
      ["exec", "knip", "--no-exit-code", "--exports", "--reporter", "json"],
      {
        encoding: "buffer",
        timeout: 45_000,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    proc.stdout.on("data", (chunk) => chunks.push(chunk));

    const errChunks = [];
    proc.stderr.on("data", (chunk) => errChunks.push(chunk));

    proc.on("error", (err) => {
      reject(new Error("Knip process error: " + err.message));
    });

    proc.on("close", (code) => {
      const stdout = Buffer.concat(chunks).toString("utf8");
      const stderr = Buffer.concat(errChunks).toString("utf8");

      if (code === null) {
        reject(new Error("Knip process was killed by a signal. stderr: " + stderr.slice(0, 500)));
        return;
      }

      const jsonStart = stdout.indexOf("{");
      if (jsonStart === -1) {
        reject(
          new Error(
            "No JSON found in Knip output.\nstderr: " +
              stderr.slice(0, 500) +
              "\nstdout: " +
              stdout.slice(0, 300),
          ),
        );
        return;
      }

      resolvePromise(stdout.slice(jsonStart));
    });
  });
}

// ---------------------------------------------------------------------------
// Violation reporting
// ---------------------------------------------------------------------------

function reportViolations(violations, isScoped, fileCount) {
  if (violations.length === 0) {
    if (isScoped) {
      console.log("All exports in " + fileCount + " file(s) are used.");
    } else {
      console.log("No unused exports found.");
    }
    return;
  }

  for (const v of violations) {
    console.error(
      v.file + ":" + v.line + ":" + v.col + "  error  Unused " + v.kind + ': "' + v.name + '"',
    );
  }

  const label = violations.length === 1 ? "unused symbol" : "unused symbols";
  console.error(
    "\nFound " +
      violations.length +
      " " +
      label +
      ". Remove them or add the --no-exit-code flag.\n" +
      "(Hint: if these are false positives, add an entry point or pattern\n" +
      " to knip.json or ignoreDependencies.)",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  const doBuildIndex = args.includes("--build-index");
  const doChangedFiles = args.includes("--changed-files");

  // Collect positional file paths (everything after --changed-files that isn't a flag)
  const changedFilesIdx = args.indexOf("--changed-files");
  const allFiles = args.filter((a) => !a.startsWith("--"));
  const changedFiles =
    changedFilesIdx >= 0
      ? args.slice(changedFilesIdx + 1).filter((a) => !a.startsWith("--"))
      : allFiles;

  const isScoped = changedFiles.length > 0;
  const normalisedFilters = changedFiles.map(normalise);

  // --- Mode 3: --build-index ---
  if (doBuildIndex) {
    await buildIndex();
    return;
  }

  // --- Mode 2: --changed-files (fast index-based check) ---
  if (doChangedFiles) {
    let indexData = loadIndex();

    if (!indexData) {
      console.log("No cached index found. Building one now...");
      indexData = await buildIndex();
    }

    const violations = [];
    let foundCount = 0;

    for (const filePath of changedFiles) {
      const normalised = normalise(filePath);
      // Find matching entry in index (try the exact path, then relative)
      let fileEntry = indexData[filePath];
      if (!fileEntry) {
        const relPath = relative(resolve("."), normalised);
        fileEntry = indexData[relPath];
      }
      if (!fileEntry) {
        continue;
      }
      foundCount++;

      for (const [exportName, info] of Object.entries(fileEntry)) {
        if (info.importedBy.length === 0) {
          violations.push({
            file: filePath,
            line: info.line,
            col: info.col,
            name: exportName,
            kind: info.kind,
          });
        }
      }
    }

    if (foundCount === 0 && changedFiles.length > 0) {
      console.warn(
        "Warning: none of the " +
          changedFiles.length +
          " specified file(s) were found in the export index.\n" +
          "Files under " +
          SCAN_GLOB +
          " are included; other paths are skipped.",
      );
    }

    reportViolations(violations, isScoped, changedFiles.length);
    return;
  }

  // --- Mode 1: full Knip scan (default) ---
  let jsonText;
  try {
    jsonText = await runKnip();
  } catch (err) {
    console.error("check-unused-exports: internal error");
    console.error(err.message);
    process.exit(2);
  }

  let report;
  try {
    report = JSON.parse(jsonText);
  } catch {
    console.error("check-unused-exports: internal error - failed to parse Knip JSON");
    console.error(jsonText.slice(0, 500));
    process.exit(2);
  }

  const issues = report.issues;
  if (!Array.isArray(issues)) {
    console.error('check-unused-exports: unexpected Knip output shape - "issues" is not an array');
    const keys = Object.keys(report).join(", ");
    console.error("Top-level keys in report: " + keys);
    process.exit(2);
  }

  const violations = [];

  for (const entry of issues) {
    const filePath = entry.file;
    if (isScoped && !normalisedFilters.includes(normalise(filePath))) {
      continue;
    }

    const categories = [
      { key: "exports", kind: "export" },
      { key: "types", kind: "type" },
      { key: "enumMembers", kind: "enum member" },
      { key: "namespaceMembers", kind: "namespace member" },
    ];

    for (const { key, kind } of categories) {
      const items = entry[key];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        violations.push({
          file: filePath,
          line: item.line,
          col: item.col,
          name: item.name,
          kind,
        });
      }
    }
  }

  reportViolations(violations, isScoped, changedFiles.length);
}

main();
