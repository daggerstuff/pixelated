// Patches @astrojs/vercel nft.js to exclude ai/.venv and ai/docs from NFT scan.
// Vercel's NFT (nodeFileTrace) traverses all files in the server bundle and hits
// ai/.venv which contains broken symlinks that crash the build.
// This script is called by postinstall and also run manually after pnpm install.
// It is idempotent — safe to run multiple times.

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const NFT_JS = resolve(__dirname, "../node_modules/@astrojs/vercel/dist/lib/nft.js");

const MARKER = "IGNORE_PATTERNS";

function patch() {
  const src = readFileSync(NFT_JS, "utf8");
  if (src.includes(MARKER)) {
    console.log("[@astrojs/vercel] nft.js fix already applied — skipping");
    return;
  }

  const IGNORE_BLOCK = `const IGNORE_PATTERNS = ["ai/.venv", "ai/docs"];
  const isUriUnsafe = f => /[ #'%]/.test(f);
  const result = await nodeFileTrace([entryPath], {
    base: fileURLToPath(base),
    ignore(path, parent) {
      return IGNORE_PATTERNS.some(p => path.includes(p));
    },
    cache
  });
  result.fileList = new Set([...result.fileList].filter(f => !IGNORE_PATTERNS.some(p => f.includes(p)) && !isUriUnsafe(f)));`;

  const patched = src.replace(
    /const \{ nodeFileTrace \} = await import\("@vercel\/nft"\);\s*const result = await nodeFileTrace\(\[entryPath\], \{\s*base: fileURLToPath\(base\),\s*cache\s*\}\);/,
    `const { nodeFileTrace } = await import("@vercel/nft");\n  ${IGNORE_BLOCK}`,
  );

  writeFileSync(NFT_JS, patched, "utf8");
  console.log("[@astrojs/vercel] nft.js patched — ai/.venv and ai/docs excluded from NFT scan");
}

try {
  patch();
} catch (err) {
  console.error("[@astrojs/vercel] patch failed:", err.message);
  process.exit(0); // do not block install
}
