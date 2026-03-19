import { readFile, writeFile, readdir } from "fs/promises";
import { join, dirname, resolve, sep, isAbsolute } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DOCS_DIR = join(__dirname, "..", "docs");
const DOCS_ROOT = resolve(DOCS_DIR);

function safeChildPath(parentDir, childName) {
  if (!childName || isAbsolute(childName) || childName.includes("..") || childName.includes("/") || childName.includes("\\")) {
    throw new Error(`Unsafe directory entry: ${childName}`);
  }
  const candidate = resolve(parentDir, childName);
  if (candidate !== DOCS_ROOT && !candidate.startsWith(DOCS_ROOT + sep)) {
    throw new Error(`Path escapes docs root: ${childName}`);
  }
  return candidate;
}

async function fixFile(filepath) {
  const content = await readFile(filepath, "utf-8");
  const lines = content.split("\n");
  const headingCount = {};
  let modified = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(\s*)(#{1,6})\s+(.+?)(\s*)$/);
    if (match) {
      const [, leading, hashes, text] = match;
      const level = hashes.length;
      const key = `${level}|${text}`;
      if (headingCount[key]) {
        headingCount[key]++;
        const newText = `${text} (${headingCount[key]})`;
        lines[i] = leading + hashes + ' ' + newText;
        modified = true;
      } else {
        headingCount[key] = 1;
      }
    }
  }

  if (modified) {
    await writeFile(filepath, lines.join("\n"), "utf-8");
    return true;
  }
  return false;
}

async function walk(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    let p;
    try {
      p = safeChildPath(dir, e.name);
    } catch {
      continue;
    }
    if (e.isDirectory()) {
      if (e.name === ".git" || e.name === "node_modules") continue;
      await walk(p, files);
    } else if (e.isFile()) {
      const ext = p.split('.').pop();
      if (ext === "md" || ext === "mdx") files.push(p);
    }
  }
  return files;
}

async function main() {
  const files = await walk(DOCS_DIR);
  let count = 0;
  for (const f of files) {
    if (await fixFile(f)) count++;
  }
  console.log(`Modified ${count} files to eliminate duplicate headings.`);
}

main().catch(console.error);
