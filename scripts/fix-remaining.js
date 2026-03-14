import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const REPO_DIR = "/home/vivi/pixelated";

// Files and their duplicate heading patterns
const fixes = [
  // MD024: make duplicates unique
  {
    file: "docs/api-reference/authentication.mdx",
    replacements: [
      { old: "## Unique permissions\n\n    - View and annotate trainee sessions", new: "## Supervisor permissions\n\n    - View and annotate trainee sessions" },
      { old: "## Unique permissions\n\n    - Create and manage own training sessions", new: "## Therapist permissions\n\n    - Create and manage own training sessions" },
      { old: "## Unique permissions\n\n    - View public scenario library", new: "## User permissions\n\n    - View public scenario library" },
    ]
  },
  // MD026 trailing punctuation: we'll fix all heading lines with trailing punctuation
  // We'll do that separately
];

// Apply
for (const f of fixes) {
  const path = join(REPO_DIR, f.file);
  const content = await readFile(path, "utf-8");
  let updated = content;
  for (const r of f.replacements) {
    if (updated.includes(r.old)) {
      updated = updated.replace(r.old, r.new);
    }
  }
  if (updated !== content) {
    await writeFile(path, updated, "utf-8");
    console.log(`✓ ${f.file}`);
  }
}
