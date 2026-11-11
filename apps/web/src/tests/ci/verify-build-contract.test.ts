/**
 * Comment-awareness of `scripts/ci/verify-build-contract.mjs`.
 *
 * The scanner's regexes match `import … from "…"` anywhere in a file, so a doc
 * comment that quotes an import-like phrase used to fail the CI `Build Docker
 * image` step while the sibling `Check for unresolved imports` step (which
 * strips comments) passed. Observed on PR #6671: one red CI round, about 20
 * minutes.
 *
 * These tests drive the real script as a child process against a throwaway
 * project tree, because that is how CI invokes it (`node
 * scripts/ci/verify-build-contract.mjs` from the repository root). They cover
 * both directions of the contract:
 *
 *   - import-like text inside a line comment, a block comment, an HTML comment
 *     and a CSS comment does not fail the scan
 *   - a genuinely unresolved local import, a genuinely unresolved package
 *     import and a genuinely unresolved CSS import still fail with exit 1
 *   - an import that follows `//` inside a string on the same line is still
 *     scanned, so the comment stripper cannot weaken the check
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

// Vitest runs from the repository root (its config resolves aliases against
// `process.cwd()`), which is also the root the scanner reads `package.json`
// and `apps/web/src` from when CI invokes it.
const repoRoot = process.cwd()
const scannerPath = path.join(
  repoRoot,
  'scripts',
  'ci',
  'verify-build-contract.mjs',
)

let fixtureRoots: string[] = []

function createFixture(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'build-contract-'))
  fixtureRoots.push(root)
  writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: 'build-contract-fixture',
      private: true,
      dependencies: {},
      devDependencies: {},
    }),
  )
  for (const [relativePath, content] of Object.entries(files)) {
    const absolute = path.join(root, relativePath)
    mkdirSync(path.dirname(absolute), { recursive: true })
    writeFileSync(absolute, content)
  }
  return root
}

function runScanner(cwd: string) {
  return spawnSync(process.execPath, [scannerPath], {
    cwd,
    encoding: 'utf8',
    timeout: 30_000,
  })
}

afterEach(() => {
  for (const root of fixtureRoots) {
    rmSync(root, { recursive: true, force: true })
  }
  fixtureRoots = []
})

describe('import-like text inside comments', () => {
  it('passes when a page quotes imports only in line, block, HTML and CSS comments', () => {
    const root = createFixture({
      'apps/web/src/pages/index.astro': `---
// A doc comment that quotes an import:
//   import { ghost } from "ghost-package-not-installed"
/*
 * import { alsoGhost } from "./also-not-here"
 */
const greeting = 'hello'
---
<html>
  <body>
    <!-- import { markupGhost } from "html-comment-ghost" -->
    <p>{greeting}</p>
  </body>
</html>
`,
    })

    const result = runScanner(root)

    expect(result.stderr).not.toContain('unresolved imports')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Build contract validation passed')
  })

  it('ignores a commented-out CSS @import but still checks the real one', () => {
    const root = createFixture({
      'apps/web/src/pages/index.astro': `---
import siteStyles from '../styles/site.css'
---
<html><body>{siteStyles}</body></html>
`,
      'apps/web/src/styles/site.css': `/* @import "./ghost.css"; */
@import "./real.css";
`,
      'apps/web/src/styles/real.css': 'body { color: black; }\n',
    })

    const result = runScanner(root)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Build contract validation passed')
  })
})

describe('a genuinely unresolved import still fails', () => {
  it('fails on an unresolved local import', () => {
    const root = createFixture({
      'apps/web/src/pages/index.astro': `---
import { missing } from './missing-module'
---
<html><body>ok</body></html>
`,
    })

    const result = runScanner(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('./missing-module')
    expect(result.stderr).toContain('local file import cannot be resolved')
  })

  it('fails on an unresolved package import', () => {
    const root = createFixture({
      'apps/web/src/pages/index.astro': `---
import { missing } from 'package-that-is-not-installed'
---
<html><body>ok</body></html>
`,
    })

    const result = runScanner(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('package-that-is-not-installed')
    expect(result.stderr).toContain(
      'package or style import cannot be resolved',
    )
  })

  it('fails on an unresolved CSS @import', () => {
    const root = createFixture({
      'apps/web/src/pages/index.astro': `---
import siteStyles from '../styles/site.css'
---
<html><body>{siteStyles}</body></html>
`,
      'apps/web/src/styles/site.css': '@import "./ghost.css";\n',
    })

    const result = runScanner(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('./ghost.css')
  })

  it('still scans an import that follows // inside a string on the same line', () => {
    // A `//`-to-end-of-line stripper would blank everything after the URL and
    // silently drop the import, which is the weakening this change must avoid.
    const root = createFixture({
      'apps/web/src/pages/index.astro': `---
const endpoint = "https://example.invalid"; import { missing } from './missing-after-url'
---
<html><body>ok</body></html>
`,
    })

    const result = runScanner(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('./missing-after-url')
  })
})
