/**
 * Classification helpers for the export-usage index.
 *
 * Kept separate from check-unused-exports.mjs so that script stays under the
 * repository's 800-line hard limit.
 */

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whether an exported name is also referenced inside the file that exports it.
 *
 * The index only records importers, so a symbol with no importer looked
 * identical whether it was dead or merely over-exported. This separates the
 * two: a declaration contributes the first match, so a second match on
 * identifier boundaries means the symbol is used locally and the fix is to
 * drop `export`, not the declaration.
 *
 * Deliberately a word match rather than a parse: it can over-report (a
 * self-referential type, or the name reused as an object key), and
 * over-reporting only changes which remedy is suggested.
 */
export function hasInternalReference(source, name) {
  const declarationSource = source.replace(
    /export\s+(?:type\s+)?\{[^}]*\}(?:\s+from\s+['"][^'"]+['"])?/g,
    " ",
  );
  const pattern = new RegExp(
    "(?<![A-Za-z0-9_$])" + escapeRegExp(name) + "(?![A-Za-z0-9_$])",
    "g",
  );
  let seen = 0;
  let match;
  while ((match = pattern.exec(declarationSource)) !== null) {
    seen += 1;
    if (seen > 1) return true;
    if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
  }
  return false;
}

/**
 * Classify a scoped violation. Both kinds fail the gate; they differ in the
 * remedy, which is the point of separating them.
 */
export function classifyViolation(info) {
  if (info.importedBy.length > 0) return null;
  return info.referencedInFile ? "internal-only" : "unused";
}

export function stripComments(source) {
  let result = source.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "));
  result = result.replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
  return result;
}

export function countLines(text, pos) {
  let count = 1;
  for (let i = 0; i < pos && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) count++;
  }
  return count;
}

export function extractImports(cleanSource) {
  const imports = [];

  // import { Name1, Name2 as Alias } from './path'
  const importNamedRe = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = importNamedRe.exec(cleanSource)) !== null) {
    const names = m[1]
      .split(",")
      .map((s) => {
        const withoutTypeModifier = s.trim().replace(/^type\s+/, "");
        const parts = withoutTypeModifier.split(/\s+as\s+/);
        return parts[0].trim();
      })
      .filter(Boolean);
    imports.push({ names, source: m[2], line: countLines(cleanSource, m.index) });
  }

  // import DefaultName from './path'
  const importDefaultRe = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
  while ((m = importDefaultRe.exec(cleanSource)) !== null) {
    imports.push({ names: ["default"], source: m[2], line: countLines(cleanSource, m.index) });
  }

  // import DefaultName, { Named } from './path'
  const importDefaultNamedRe = /import\s+(\w+)\s*,\s*\{[^}]*\}\s+from\s+['"]([^'"]+)['"]/g;
  while ((m = importDefaultNamedRe.exec(cleanSource)) !== null) {
    imports.push({ names: ["default"], source: m[2], line: countLines(cleanSource, m.index) });
  }

  // import * as Namespace from './path'
  const importNamespaceRe = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
  while ((m = importNamespaceRe.exec(cleanSource)) !== null) {
    imports.push({ names: [m[1]], source: m[2], line: countLines(cleanSource, m.index) });
  }

  // Dynamic imports: import('...') with member access like module.Name
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
