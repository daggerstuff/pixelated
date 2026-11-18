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
import { accessSync, constants, mkdirSync, writeFileSync, readFileSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";

import {
  classifyViolation,
  countLines,
  extractImports,
  hasInternalReference,
  stripComments,
} from "./export-classification.mjs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INDEX_PATH = resolve(".cache/knip-index.json");
const INDEX_VERSION = 4;
const SCAN_GLOB = "apps/web/src/**/*.{ts,tsx,js,jsx,astro}";
const CONSUMER_GLOB = "{apps/web/src,tests}/**/*.{test,spec}.{ts,tsx,js,jsx}";
const CONSUMER_IGNORE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.astro/**",
];
const SCAN_IGNORE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.astro/**",
  "**/*.test.{ts,tsx,js,jsx}",
  "**/*.spec.{ts,tsx,js,jsx}",
  "**/*.generated.*",
  "**/*.d.ts",
  "apps/web/src/lib/governance/policy-engine.ts",
  "apps/web/src/lib/audit.ts",
  "apps/web/src/lib/research/services/*.ts",
  "apps/web/src/lib/ai/bias-detection/BiasDetectionEngine.ts",
  "apps/web/src/lib/ai/services/*.ts",
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

function warnUnreadable(file, error) {
  const detail = error instanceof Error ? error.message : String(error);
  console.warn("check-unused-exports: could not read " + file + " (" + detail + "); using the index entry.");
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
    exports.push({ name: m[0].includes("default") ? "default" : m[1], line, col, kind });
  }

  // export default Identifier (re-exporting a previously defined symbol, common in React)
  // Must NOT be followed by a declaration keyword, to avoid double-counting.
  const exportDefaultRe = /export\s+default\s+(\w+)\s*;?$/gm;
  while ((m = exportDefaultRe.exec(cleanSource)) !== null) {
    // Skip if this export was already captured by exportDeclRe (e.g., export default function X)
    const line = countLines(cleanSource, m.index);
    const col = m.index - cleanSource.lastIndexOf("\n", m.index - 1) - 1;
    // Avoid duplicates: only add if this name is not already in exports
    const alreadyExists = exports.some((e) => e.name === "default" && Math.abs(e.line - line) < 2);
    if (!alreadyExists) {
      exports.push({ name: "default", line, col, kind: "export" });
    }
  }

  // export { Name1, Name2 as Alias }
  const exportNamedRe = /export\s+\{([^}]+)\}(?:\s+from\s+['"][^'"]+['"])?/g;
  while ((m = exportNamedRe.exec(cleanSource)) !== null) {
    const list = m[1]
      .split(",")
      .map((s) => {
        const parts = s.trim().split(/\s+as\s+/);
        const exported = (parts[1] ?? parts[0]).trim();
        return exported.replace(/^type\s+/, "");
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


/**
 * Extract import statements from source code.
 * Returns array of { names: string[], source: string, line }.
 */

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
      fileExports.set(
        absPath,
        exports.map((exp) => ({
          ...exp,
          referencedInFile: hasInternalReference(cleanSource, exp.name),
        })),
      );
    }
  }

  // Phase 2: extract imports from every file and cross-reference
  /** @type {Map<string, Map<string, Set<string>>>} */
  // file -> exportName -> Set<consumerFilePath>
  const usage = new Map();

  const collectUsage = async (fileList) => {
    for (const file of fileList) {
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
  };

  await collectUsage(files);
  await collectUsage(await glob(CONSUMER_GLOB, { ignore: CONSUMER_IGNORE }));

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
        referencedInFile: exp.referencedInFile === true,
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

const KNIP_ARGS = ["--no-exit-code", "--exports", "--reporter", "json"];

function runKnip() {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    const knipEntry = resolve("node_modules/knip/bin/knip.js");
    const useDirectEntry = pathExists(knipEntry);
    const proc = spawn(
      useDirectEntry ? process.execPath : "pnpm",
      useDirectEntry
        ? [knipEntry, ...KNIP_ARGS]
        : ["exec", "knip", ...KNIP_ARGS],
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
    if (v.violationKind === "internal-only") {
      console.error(
        v.file +
          ":" +
          v.line +
          ":" +
          v.col +
          "  error  Over-exported " +
          v.kind +
          ': "' +
          v.name +
          '" is referenced only inside its own file. Drop the `export` keyword; the declaration is live.',
      );
    } else if (v.violationKind === "unused") {
      console.error(
        v.file +
          ":" +
          v.line +
          ":" +
          v.col +
          "  error  Unused " +
          v.kind +
          ': "' +
          v.name +
          '" has no importer and no in-file reference. Delete it.',
      );
    } else {
      console.error(
        v.file + ":" + v.line + ":" + v.col + "  error  Unused " + v.kind + ': "' + v.name + '"',
      );
    }
  }

  const overExported = violations.filter((v) => v.violationKind === "internal-only").length;
  const unused = violations.length - overExported;
  const parts = [];
  if (unused > 0) parts.push(unused + (unused === 1 ? " unused symbol" : " unused symbols"));
  if (overExported > 0) {
    parts.push(
      overExported + (overExported === 1 ? " over-exported symbol" : " over-exported symbols"),
    );
  }

  console.error(
    "\nFound " +
      parts.join(" and ") +
      ". Fix them or add the --no-exit-code flag.\n" +
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

      let cleanSource = null;
      try {
        cleanSource = stripComments(await readFile(resolve(normalised), "utf8"));
      } catch (error) {
        warnUnreadable(normalised, error);
      }

      for (const [exportName, info] of Object.entries(fileEntry)) {
        const referencedInFile =
          exportName === "default" || cleanSource === null
            ? info.referencedInFile
            : hasInternalReference(cleanSource, exportName);
        const violationKind = classifyViolation({ ...info, referencedInFile });
        if (!violationKind) continue;
        violations.push({
          file: filePath,
          line: info.line,
          col: info.col,
          name: exportName,
          kind: info.kind,
          violationKind,
        });
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
  const cleanSourceCache = new Map();

  for (const entry of issues) {
    const filePath = entry.file;
    if (isScoped && !normalisedFilters.includes(normalise(filePath))) {
      continue;
    }

    let cleanSource = cleanSourceCache.get(filePath);
    if (cleanSource === undefined) {
      try {
        cleanSource = stripComments(await readFile(resolve(filePath), "utf8"));
      } catch (error) {
        warnUnreadable(filePath, error);
      }
      cleanSourceCache.set(filePath, cleanSource);
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
        const referencedInFile =
          item.name === "default" || cleanSource === null
            ? false
            : hasInternalReference(cleanSource, item.name);
        violations.push({
          file: filePath,
          line: item.line,
          col: item.col,
          name: item.name,
          kind,
          violationKind: classifyViolation({ importedBy: [], referencedInFile }),
        });
      }
    }
  }

  reportViolations(violations, isScoped, changedFiles.length);
}

function isDirectInvocation() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectInvocation()) {
  main().catch((error) => {
    console.error("check-unused-exports: internal error");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  });
}
