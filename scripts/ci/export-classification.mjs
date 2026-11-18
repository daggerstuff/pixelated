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
  const declarationSource = source
    .replace(/export\s+(?:type\s+)?\{[^}]*\}(?:\s+from\s+['"][^'"]+['"])?/g, " ")
    .replace(/export\s+default\s+[A-Za-z_$][\w$]*\s*;/g, " ");
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
