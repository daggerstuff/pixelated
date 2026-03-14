#!/usr/bin/env node
import { readdir, readFile, writeFile } from "fs/promises";
import { extname, join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_DIR = join(__dirname, "..");
const DOCS_DIR = join(REPO_DIR, "docs");

let totalFiles = 0, filesModified = 0, fixesByRule = {};

function trackFix(rule) { fixesByRule[rule] = (fixesByRule[rule] || 0) + 1; }

function fixMD030(c) {
  const l = c.split("\n"); let m = false;
  for (let i = 0; i < l.length; i++) {
    const match = l[i].match(/^(\s*)([-*]|\d+\.)(\s{2,})(.*)$/);
    if (match) { l[i] = `${match[1]}${match[2]} ${match[4]}`; m = true; trackFix("MD030"); }
  }
  return m ? l.join("\n") : null;
}

function fixMD026(c) {
  const l = c.split("\n"); let m = false;
  for (let i = 0; i < l.length; i++) {
    const match = l[i].match(/^(#+\s+.*?)([.!?:;])(\s*)$/);
    if (match) { l[i] = match[1] + match[3]; m = true; trackFix("MD026"); }
  }
  return m ? l.join("\n") : null;
}

function fixMD028(c) {
  const l = c.split("\n"); let m = false; let inBQ = false;
  for (let i = 0; i < l.length; i++) {
    const line = l[i];
    if (line.startsWith(">")) {
      inBQ = true;
      if (line.slice(1).trim() === "") { l[i] = ">"; m = true; trackFix("MD028"); }
    } else if (line.trim() !== "") { inBQ = false; }
    else if (inBQ) { l[i] = null; m = true; trackFix("MD028"); }
  }
  return m ? l.filter(x => x !== null).join("\n") : null;
}

function fixMD029(c) {
  const l = c.split("\n"); let m = false;
  for (let i = 0; i < l.length; i++) {
    const match = l[i].match(/^(\s*)(\d+)(\.\s+)(.*)$/);
    if (match && match[2] !== "1") { l[i] = `${match[1]}1${match[3]}${match[4]}`; m = true; trackFix("MD029"); }
  }
  return m ? l.join("\n") : null;
}

function fixMD034(c) {
  const pattern = /(?<!<)(https?:\/\/[^\s<]+)(?!>)/g;
  const orig = c.length;
  const fixed = c.replace(pattern, (full, url, offset, str) => {
    if (offset > 0 && str.charAt(offset - 1) === "<") return full;
    if (str.substring(offset).startsWith(url + ">")) return full;
    if (str.substring(0, offset).match(/\[[^\]]*\]\([^)]*$/)) return full;
    trackFix("MD034"); return `<${url}>`;
  });
  return fixed.length !== orig ? fixed : null;
}

function fixMD031(c) {
  const l = c.split("\n"); let m = false;
  for (let i = 0; i < l.length; i++) {
    const t = l[i].trim();
    if (t === "```" || t.startsWith("```")) {
      let b = i - 1; while (b >= 0 && l[b].trim() === "") b--;
      if ((b < 0 || l[b].trim() !== "") && i > 0) { l.splice(i, 0, ""); m = true; trackFix("MD031"); i++; }
      let j = i + 1; while (j < l.length && !(l[j].trim() === "```" || l[j].trim().startsWith("```"))) j++;
      if (j < l.length) {
        let a = j + 1; while (a < l.length && l[a].trim() === "") a++;
        if (a < l.length && l[a].trim() !== "") { l.splice(j + 1, 0, ""); m = true; trackFix("MD031"); }
      }
    }
  }
  return m ? l.join("\n") : null;
}

function fixMD040(c) {
  const l = c.split("\n"); let m = false;
  for (let i = 0; i < l.length; i++) {
    const t = l[i].trim();
    if ((t === "```" || /^```[\w]*$/.test(t)) && !t.includes("{") && !t.includes('"')) {
      let lang = "text";
      const max = Math.min(i + 20, l.length);
      let found = false;
      for (let j = i + 1; j < max; j++) {
        const s = l[j].trim();
        if (s === "```" || /^```[\w]*$/.test(s)) { found = true; break; }
        const sample = l[j].toLowerCase();
        if (sample.includes("{") && sample.includes("}")) { lang = "json"; break; }
        if (sample.startsWith("$") || sample.startsWith("#") || sample.includes("curl ") || sample.includes("apt-") || sample.includes("docker ") || sample.includes("npm ") || sample.includes("pnpm ") || sample.includes("yarn ") || sample.includes("make ") || sample.startsWith("export ") || sample.startsWith("source ")) { lang = "bash"; break; }
        if (sample.includes("def ") || sample.includes("import ") || sample.includes("from ") || sample.includes("class ") || sample.includes("python")) { lang = "python"; break; }
        if (sample.includes("function ") || sample.includes("const ") || sample.includes("let ") || sample.includes("var ") || sample.includes("import ") || sample.includes("export ") || sample.includes("interface ") || sample.includes("type ")) { lang = "typescript"; break; }
        if (sample.includes("<") && sample.includes(">") && !sample.includes("</")) { if (sample.includes("=") && (sample.includes('"') || sample.includes("'"))) { lang = "html"; break; } }
      }
      if (found && !t.includes(" ")) { l[i] = t + " " + lang; m = true; trackFix("MD040"); }
    }
  }
  return m ? l.join("\n") : null;
}

function fixMD036(c) {
  const l = c.split("\n"); let m = false;
  for (let i = 0; i < l.length; i++) {
    const match = l[i].match(/^\s*(\*\*|__)(.+?)\1\s*$/);
    if (match && !l[i].startsWith("#") && !l[i].startsWith("-") && !l[i].startsWith("*") && !l[i].startsWith("1.") && !l[i].match(/^\s*\d+\.\s/)) {
      const prev = i > 0 ? l[i - 1] : "";
      if (prev.trim() === "" || prev.startsWith("#")) { l[i] = `## ${match[2]}`; m = true; trackFix("MD036"); }
    }
  }
  return m ? l.join("\n") : null;
}

function fixMD025(c) {
  const l = c.split("\n"); let m = false; let count = 0;
  for (let i = 0; i < l.length; i++) {
    if (l[i].trim().startsWith("# ") && !l[i].trim().startsWith("##")) {
      count++;
      if (count > 1) { l[i] = l[i].replace(/^# /, "## "); m = true; trackFix("MD025"); }
    }
  }
  return m ? l.join("\n") : null;
}

function fixMD013(c) {
  const l = c.split("\n"); let m = false;
  for (let i = 0; i < l.length; i++) {
    const line = l[i];
    if (line.trim().startsWith("```") || line.trim().startsWith("|") || line.includes("http://") || line.includes("https://")) continue;
    if (line.length > 120 && !line.match(/^\s*[a-zA-Z0-9_]+:/)) {
      const bp = line.lastIndexOf(" ", 120);
      if (bp > 60) { l[i] = line.substring(0, bp); l.splice(i + 1, 0, line.substring(bp + 1)); m = true; trackFix("MD013"); }
    }
  }
  return m ? l.join("\n") : null;
}

async function processFile(fp) {
  const orig = await readFile(fp, "utf-8");
  let content = orig;
  let changes = 0;
  const fixes = [fixMD030, fixMD026, fixMD028, fixMD029, fixMD034, fixMD040, fixMD036, fixMD025, fixMD031, fixMD013];
  for (const f of fixes) {
    const res = f(content);
    if (res) { content = res; changes++; }
  }
  if (changes > 0) {
    await writeFile(fp, content, "utf-8");
    console.log(`✓ ${fp.replace(REPO_DIR + "/", "")} (${changes})`);
    return changes;
  }
  return 0;
}

async function getAllMarkdownFiles(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fp = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      await getAllMarkdownFiles(fp, files);
    } else if (entry.isFile()) {
      const ext = extname(entry.name);
      if (ext === ".md" || ext === ".mdx") files.push(fp);
    }
  }
  return files;
}

async function main() {
  console.log("Scanning...");
  const files = await getAllMarkdownFiles(DOCS_DIR);
  totalFiles = files.length;
  console.log(`Found ${totalFiles} files. Processing...\n`);
  for (const file of files.sort()) {
    try { if (await processFile(file)) filesModified++; } catch (e) { console.error(`✗ ${file}: ${e.message}`); }
  }
  console.log("\n" + "=".repeat(50));
  console.log("SUMMARY");
  console.log(`Files: ${filesModified}/${totalFiles} modified`);
  console.log("\nFixes:");
  for (const [r, c] of Object.entries(fixesByRule).sort((a, b) => b[1] - a[1])) console.log(`  ${r}: ${c}`);
  console.log("=".repeat(50));
}

main().catch(console.error);
