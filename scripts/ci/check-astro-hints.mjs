#!/usr/bin/env node
/**
 * @file scripts/ci/check-astro-hints.mjs
 *
 * Runs `astro check`, parses the hint count from its output, and compares it
 * against the baseline stored in `.baselines/astro-hints.json`.
 *
 * Behaviour:
 *   - Hints ≤ baseline → exit 0 (pass)
 *   - Hints > baseline → exit 1, show hint count increase as a CI warning
 *
 * The baseline file can be regenerated with --update-baseline:
 *   node scripts/ci/check-astro-hints.mjs --update-baseline
 *
 * This script is intended to be run in CI with allow_failure / continue-on-error
 * so that a hint increase is a warning, not a hard failure.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../..')
const BASELINE_PATH = resolve(PROJECT_ROOT, '.baselines/astro-hints.json')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run `astro check` and return its full stdout+stderr output.
 * We merge streams because astro check diagnostics go to stderr.
 */
function runAstroCheck() {
  const result = spawnSync('pnpm', ['astro', 'check'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_OPTIONS: '--max-old-space-size=8192',
    },
    maxBuffer: 20 * 1024 * 1024, // 20 MB — astro check output can be large
  })
  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  return { output: stdout + stderr, status: result.status }
}

/**
 * Parse the hint/warning/error counts from astro check output.
 *
 * Astro check outputs counts in this multi-line format:
 *   Result (2519 files):
 *   - 0 errors
 *   - 0 warnings
 *   - 511 hints
 *
 * Returns null if counts can't be parsed.
 */
function parseHintCount(output) {
  try {
    const errors = output.match(/-\s*(\d+)\s+errors?/)
    const warnings = output.match(/-\s*(\d+)\s+warnings?/)
    const hints = output.match(/-\s*(\d+)\s+hints?/)

    if (errors || warnings || hints) {
      return {
        errors: errors ? Number.parseInt(errors[1], 10) : 0,
        warnings: warnings ? Number.parseInt(warnings[1], 10) : 0,
        hints: hints ? Number.parseInt(hints[1], 10) : 0,
      }
    }

    // Fallback: try the inline summary format "X errors, Y warnings, Z hints"
    const summaryMatch = output.match(
      /(\d+)\s+errors?,\s+(\d+)\s+warnings?,\s+(\d+)\s+hints?/,
    )
    if (summaryMatch) {
      return {
        errors: Number.parseInt(summaryMatch[1], 10),
        warnings: Number.parseInt(summaryMatch[2], 10),
        hints: Number.parseInt(summaryMatch[3], 10),
      }
    }

    // Fallback: try the generic "X problems" format
    const problemMatch = output.match(/(\d+)\s+problems?/)
    if (problemMatch) {
      return {
        errors: 0,
        warnings: 0,
        hints: Number.parseInt(problemMatch[1], 10),
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Read the baseline file. Returns null if it doesn't exist or is malformed.
 */
async function readBaseline() {
  if (!existsSync(BASELINE_PATH)) {
    return null
  }
  try {
    const raw = await readFile(BASELINE_PATH, 'utf8')
    const data = JSON.parse(raw)
    return {
      hints: data.hints,
      warnings: data.warnings ?? 0,
      errors: data.errors ?? 0,
    }
  } catch {
    return null
  }
}

/**
 * Write the baseline file with the given counts.
 */
async function writeBaseline({ errors, warnings, hints }) {
  const content = JSON.stringify(
    {
      hints,
      warnings,
      errors,
      metadata: {
        description:
          'Baseline astro check diagnostic counts. The CI check-astro-hints step warns if the hint count increases above this baseline.',
        generated_at: new Date().toISOString(),
        update_instructions:
          "Run 'node scripts/ci/check-astro-hints.mjs --update-baseline' to regenerate.",
      },
    },
    null,
    2,
  )
  await writeFile(BASELINE_PATH, content, 'utf8')
  console.log(`  Baseline updated: ${hints} hints, ${warnings} warnings, ${errors} errors`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const isUpdateBaseline = args.includes('--update-baseline')

  // —————————————————————————————————————————————————
  // 1. Run astro check
  // —————————————————————————————————————————————————
  console.log('Running astro check (may take ~2 minutes)...')
  const { output, status: astroExit } = runAstroCheck()
  const counts = parseHintCount(output)

  if (!counts) {
    console.error('Failed to parse astro check output. Raw output (first 2000 chars):')
    console.error(output.slice(0, 2000))
    process.exit(2)
  }

  console.log(
    `  Result: ${counts.errors} errors, ${counts.warnings} warnings, ${counts.hints} hints`,
  )

  // —————————————————————————————————————————————————
  // 2. Update baseline if requested
  // —————————————————————————————————————————————————
  if (isUpdateBaseline) {
    await writeBaseline(counts)
    return
  }

  // —————————————————————————————————————————————————
  // 3. Compare against baseline
  // —————————————————————————————————————————————————
  const baseline = await readBaseline()

  if (!baseline) {
    console.error(
      `\nWarning: No baseline found at .baselines/astro-hints.json.`,
    )
    console.error(
      `  Run 'node scripts/ci/check-astro-hints.mjs --update-baseline' to create one.`,
    )
    process.exit(2)
  }

  const hintDiff = counts.hints - baseline.hints
  const warnDiff = counts.warnings - baseline.warnings
  const errDiff = counts.errors - baseline.errors

  const increased = hintDiff > 0 || warnDiff > 0 || errDiff > 0

  if (increased) {
    const parts = []
    if (errDiff > 0) parts.push(`errors: +${errDiff}`)
    if (warnDiff > 0) parts.push(`warnings: +${warnDiff}`)
    if (hintDiff > 0) parts.push(`hints: +${hintDiff}`)

    console.error(
      `\nWARNING: Astro check diagnostics have increased from baseline:` +
        `\n  Baseline:  ${baseline.errors}e / ${baseline.warnings}w / ${baseline.hints}h` +
        `\n  Current:   ${counts.errors}e / ${counts.warnings}w / ${counts.hints}h` +
        `\n  Increase:  ${parts.join(', ')}` +
        `\n` +
        `\n  To update the baseline (if the increase is intentional):` +
        `\n    node scripts/ci/check-astro-hints.mjs --update-baseline` +
        `\n`,
    )
    for (const line of output.split('\n')) {
      if (/ - (error|warning) /.test(line)) console.log(`DIAG ${line}`)
    }
    process.exit(1)
  }

  if (hintDiff < 0) {
    console.log(
      `\nHints decreased by ${Math.abs(hintDiff)} from baseline. Consider updating:\n` +
        `    node scripts/ci/check-astro-hints.mjs --update-baseline\n`,
    )
  } else {
    console.log(`\nAstro hints at baseline (${baseline.hints}h / ${baseline.warnings}w / ${baseline.errors}e)`)
  }
}

main().catch((err) => {
  console.error('check-astro-hints: internal error')
  console.error(err)
  process.exit(2)
})
