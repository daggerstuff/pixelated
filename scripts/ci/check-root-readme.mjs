#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = process.env.GITHUB_WORKSPACE ?? process.cwd()
const readmePath = join(repoRoot, 'README.md')

let readme
try {
  readme = readFileSync(readmePath, 'utf8')
} catch {
  console.error(`Root README not found: ${readmePath}`)
  process.exit(1)
}

const gwsMarkers = [
  '@googleworkspace/cli',
  'googleworkspace/cli',
  '<h1 align="center">gws</h1>',
  'One CLI for all of Google Workspace',
]

const found = gwsMarkers.filter((marker) => readme.toLowerCase().includes(marker.toLowerCase()))

if (found.length > 0) {
  console.error(
    [
      'Root README.md appears to be the @googleworkspace/cli README.',
      'Refusing to commit this content. Restore the Pixelated Empathy README.',
      `Matched markers: ${found.join(', ')}`,
    ].join('\n'),
  )
  process.exit(1)
}

console.log('Root README guard passed.')
