#!/usr/bin/env node
/**
 * Build wrapper that handles EPIPE errors gracefully
 *
 * Problem: During CI builds, parent process may close stdout/stderr pipes
 * before the build completes, causing Node.js to throw unhandled EPIPE errors
 *
 * Solution: This wrapper handles broken pipe errors and exits cleanly
 */
import { spawn, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import process from 'process'

import dotenv from 'dotenv'

// Remove stale build output before every build.
// This avoids rare runtime mismatches where the manifest references hashed assets
// that were removed/renamed in a previous build output (for example, 500*.mjs chunks).
const distDir = path.resolve(process.cwd(), 'dist')
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true })
}

/**
 * Collect server chunks that were compiled with React's development JSX
 * transform. Their `jsxDEV` import resolves to `undefined` under React 19's
 * production `react/jsx-dev-runtime` stub.
 *
 * @returns {string[]} repo-relative paths, sorted for stable output
 */
function findDevJsxChunks() {
  const serverDir = path.join(distDir, 'server')
  if (!fs.existsSync(serverDir)) return []

  const hits = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!entry.name.endsWith('.mjs') && !entry.name.endsWith('.js')) continue
      if (fs.readFileSync(full, 'utf8').includes('react/jsx-dev-runtime')) {
        hits.push(path.relative(process.cwd(), full))
      }
    }
  }
  walk(serverDir)
  return hits.sort()
}

const verifyCommand = ['node', 'scripts/ci/verify-build-contract.mjs']
const verify = spawnSync(verifyCommand[0], verifyCommand.slice(1), {
  stdio: 'inherit',
})
if (verify.status !== 0) {
  process.exit(verify.status ?? 1)
}

// Try to load .env file manually to ensure variables are available
try {
  const envPath = path.resolve(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath })
    if (result.error) {
      console.warn(
        '⚠️  Warning: Failed to load .env file via dotenv:',
        result.error.message,
      )
    }
  }
} catch (e) {
  console.warn('⚠️  Warning: Error trying to load .env file:', e.message)
}

// Handle EPIPE errors on stdout/stderr
process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') {
    // Parent process closed the pipe - exit gracefully
    // This is not a fatal error, just means logs won't be printed
    process.exit(0)
  }
  throw error
})

process.stderr.on('error', (error) => {
  if (error.code === 'EPIPE') {
    // Parent process closed the pipe - exit gracefully
    process.exit(0)
  }
  throw error
})

// Ignore SIGPIPE signal (common when piping to pager or when pipe closes)
// This is more robust than trying to handle it in the error handler
process.on('SIGPIPE', () => {
  // Silently exit - the pipe was closed by parent process
  process.exit(0)
})

// Spawn the actual Astro build.
//
// NODE_ENV is pinned to production on purpose. The dotenv call above loads the
// local .env, which sets NODE_ENV=development for the dev server; Vite derives
// its JSX transform mode from that flag, so a build inheriting it emits
// `jsxDEV` calls and imports `react/jsx-dev-runtime` in every React chunk.
// React 19 ships a production stub for that entry point whose `jsxDEV` export
// is `undefined`, so the artifact crashes with "jsxDEV is not a function" on
// any page that renders a React component once the server runs with
// NODE_ENV=production. `astro build` always produces a production artifact, so
// the flag is not allowed to leak in from the environment.
const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const build = spawn(pnpmCmd, ['exec', 'astro', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
})

build.on('error', (error) => {
  console.error('Failed to start build:', error)
  process.exit(1)
})

build.on('exit', (code, signal) => {
  // Exit with the same code as the build process
  // If it was killed by a signal, exit with code 1
  if (signal) {
    process.exit(1)
  }
  if (code !== 0) {
    process.exit(code ?? 1)
  }

  // Guard the invariant above: a dev-mode JSX transform produces an artifact
  // that only runs when NODE_ENV is not "production", so fail the build rather
  // than shipping it.
  const devJsx = findDevJsxChunks()
  if (devJsx.length > 0) {
    console.error(
      `❌ ${devJsx.length} server chunk(s) import react/jsx-dev-runtime — the build ` +
        'used the development JSX transform and will crash under NODE_ENV=production:',
    )
    for (const file of devJsx.slice(0, 10)) console.error(`   ${file}`)
    process.exit(1)
  }

  const ensure = spawnSync('node', ['scripts/ci/ensure-server-entry.mjs'], {
    stdio: 'inherit',
  })
  process.exit(ensure.status ?? 0)
})

// Handle parent process termination gracefully
process.on('SIGTERM', () => {
  build.kill('SIGTERM')
})

process.on('SIGINT', () => {
  build.kill('SIGINT')
})
