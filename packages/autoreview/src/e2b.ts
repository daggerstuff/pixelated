import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import type { SandboxRunner, SandboxRunResult } from './validation'

export interface E2bValidateArgs {
  repo: string
  ref: string
  command?: string
  timeoutSec?: number
}

/** Builds the argv for `scripts/e2b-validate.py` (pure, testable). */
export function buildE2bCommand(
  args: E2bValidateArgs,
  scriptPath: string,
  python: string[] = ['python3'],
): string[] {
  const argv = [...python, scriptPath, args.repo, args.ref]
  if (args.command) {
    argv.push('--command', args.command)
  }
  if (args.timeoutSec !== undefined) {
    argv.push('--timeout', String(args.timeoutSec))
  }
  return argv
}

/**
 * Parses the single JSON object emitted by the Python E2B wrapper into a
 * SandboxRunResult. Missing/invalid fields fall back to a failed exit.
 */
export function parseE2bResult(output: string): SandboxRunResult {
  const parsed = JSON.parse(output.trim()) as {
    exit_code?: unknown
    stdout?: unknown
    stderr?: unknown
  }
  return {
    exitCode: typeof parsed.exit_code === 'number' ? parsed.exit_code : 1,
    stdout: typeof parsed.stdout === 'string' ? parsed.stdout : '',
    stderr: typeof parsed.stderr === 'string' ? parsed.stderr : '',
  }
}

function defaultScriptPath(): string {
  return fileURLToPath(new URL('../scripts/e2b-validate.py', import.meta.url))
}

interface CommandOutput {
  stdout: string
  stderr: string
  code: number | null
}

function runCommand(args: string[]): Promise<CommandOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(args[0], args.slice(1), {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => reject(error))
    child.on('close', (code) => resolve({ stdout, stderr, code }))
  })
}

export interface E2bSandboxRunnerOptions {
  repo: string
  ref: string
  /** Validation command to run in the sandbox (default: install+test+lint). */
  command?: string
  /** Sandbox lifetime in seconds (default 300). */
  timeoutSec?: number
  /** Override the Python script path (tests / custom layouts). */
  scriptPath?: string
  /** Python invocation prefix, e.g. ['uv', 'run', 'python'] (default python3). */
  pythonCommand?: string[]
}

/**
 * Runs the validation suite in a fresh E2B sandbox by shelling out to
 * `scripts/e2b-validate.py`, which mirrors the repo's existing E2B usage.
 */
export class E2bSandboxRunner implements SandboxRunner {
  private readonly options: E2bSandboxRunnerOptions

  constructor(options: E2bSandboxRunnerOptions) {
    this.options = options
  }

  async run(): Promise<SandboxRunResult> {
    const scriptPath = this.options.scriptPath ?? defaultScriptPath()
    const args = buildE2bCommand(
      {
        repo: this.options.repo,
        ref: this.options.ref,
        command: this.options.command,
        timeoutSec: this.options.timeoutSec,
      },
      scriptPath,
      this.options.pythonCommand ?? ['python3'],
    )
    const { stdout, stderr, code } = await runCommand(args)
    if (code === 0) {
      return parseE2bResult(stdout)
    }
    return {
      exitCode: code ?? 1,
      stdout: '',
      stderr: stderr || stdout,
    }
  }
}
