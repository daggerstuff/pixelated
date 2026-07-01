// Patches @astrojs/vercel's nft.js to ignore ai/ directory during @vercel/nft tracing.
// Run: node patch-nft.mjs
// Safe to run repeatedly — only applies if not already fully patched.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function findNftJs() {
  const pnpmDir = resolve(__dirname, 'node_modules/.pnpm')
  const entries = readdirSync(pnpmDir, { withFileTypes: true })
  for (const ent of entries) {
    if (!ent.name.includes('@astrojs+vercel')) continue
    const nested = resolve(
      pnpmDir,
      ent.name,
      'node_modules/@astrojs/vercel/dist/lib/nft.js',
    )
    try {
      require.resolve(nested)
      return nested
    } catch {}
  }
  return null
}

const nftPath =
  findNftJs() ||
  '/home/vivi/pixelated/node_modules/.pnpm/@astrojs+vercel@10.0.8_@aws-sdk+credential-provider-web-identity@3.972.54_astro@6.4.8_@_41b86d61148770c5370c722eefd24c67/node_modules/@astrojs/vercel/dist/lib/nft.js'

let code
try {
  code = readFileSync(nftPath, 'utf8')
} catch {
  console.error('Could not find nft.js at', nftPath)
  process.exit(1)
}

// Already fully patched — IGNORE_PATTERNS array + isUriUnsafe filter both present.
if (code.includes('IGNORE_PATTERNS') && code.includes('isUriUnsafe')) {
  console.log('Already patched:', nftPath)
  process.exit(0)
}

const oldChunk = `const result = await nodeFileTrace([entryPath], {
    base: fileURLToPath(base),
    ignore(path, parent) {
      // Ignore paths inside the Python venv (not needed by the serverless function
      // and causes NFT to fail since the venv bind-mount paths don't exist in sandbox)
      return path.includes("ai/.venv");
    },
    cache
  });`

const oldSingle =
  'result = await nodeFileTrace([entryPath], { base: fileURLToPath(base), cache });'

const newCode = `const IGNORE_PATTERNS = ["ai/.venv", "ai/docs"];
  const result = await nodeFileTrace([entryPath], {
    base: fileURLToPath(base),
    ignore(path, parent) {
      // Ignore paths in the Python venv and docs — not needed by the serverless
      // function and cause NFT to fail (venv bind-mount paths don't exist in the
      // sandbox; docs contain URL-unsafe characters).
      return IGNORE_PATTERNS.some(p => path.includes(p));
    },
    cache
  });
  result.fileList = new Set([...result.fileList].filter(f => !IGNORE_PATTERNS.some(p => f.includes(p))));`

if (code.includes(oldChunk)) {
  code = code.replace(oldChunk, newCode)
} else if (code.includes(oldSingle)) {
  code = code.replace(oldSingle, newCode)
} else {
  // Already patched with styles we don't recognize — but if IGNORE_PATTERNS exists, it's fine.
  if (code.includes('IGNORE_PATTERNS')) {
    console.log('Already patched (variant):', nftPath)
    process.exit(0)
  }
  console.error(
    'Could not find the nodeFileTrace call to patch. Dumping around it:',
  )
  const idx = code.indexOf('nodeFileTrace([entryPath]')
  console.error(code.slice(Math.max(0, idx - 30), idx + 250))
  process.exit(1)
}

writeFileSync(nftPath, code, 'utf8')
console.log('Patched:', nftPath)
