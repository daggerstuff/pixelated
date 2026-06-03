/**
 * Pre-Tool-Use Hook for Dynamic Permission Control
 *
 * This hook intercepts tool execution requests and applies intelligent
 * permission logic based on the tool type, target files, and operation.
 *
 * Exit codes:
 *   0 = allow (prints permissionDecision: "allow")
 *   1 = ask user (prints permissionDecision: "ask")
 *   2 = deny (prints permissionDecision: "deny")
 */

import { stdin, stdout, stderr } from 'node:process'

// Read hook payload from stdin
async function readStdin() {
  const chunks = []
  for await (const chunk of stdin) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

// Decision matrix for tool permissions
function makeDecision(payload) {
  const { tool, args } = payload

  // Allow all read operations on tracked files
  if (tool === 'read_file' || tool === 'list_directory') {
    return { permissionDecision: 'allow' }
  }

  // Allow git operations (safe, reversible)
  if (tool === 'shell' && args?.command?.startsWith('git ')) {
    // Deny force pushes and hard resets
    const dangerousOps = ['push --force', 'reset --hard', 'clean -fd']
    if (dangerousOps.some((op) => args.command.includes(op))) {
      return {
        permissionDecision: 'deny',
        reason: 'Destructive git operation blocked',
      }
    }
    return { permissionDecision: 'allow' }
  }

  // Allow pnpm commands (package manager is trusted)
  if (tool === 'shell' && args?.command?.startsWith('pnpm ')) {
    // Block install in CI to prevent lockfile drift
    if (args.command.includes('install') && process.env.CI === 'true') {
      return {
        permissionDecision: 'ask',
        reason: 'Package install in CI - verify lockfile',
      }
    }
    return { permissionDecision: 'allow' }
  }

  // Allow uv run for Python (sandboxed execution)
  if (tool === 'shell' && args?.command?.startsWith('uv run ')) {
    return { permissionDecision: 'allow' }
  }

  // Block direct python/pip usage (project policy)
  if (
    tool === 'shell' &&
    (args?.command?.startsWith('python ') ||
      args?.command?.startsWith('pip ') ||
      args?.command?.startsWith('npm '))
  ) {
    return {
      permissionDecision: 'deny',
      reason:
        'Use `uv run` for Python or `pnpm` for Node.js per project policy',
    }
  }

  // Block network access to internal IPs
  if (tool === 'shell' && args?.command?.match(/curl|wget|fetch/)) {
    if (args.command.match(/127\.0\.0\.1|localhost|192\.168\.|10\.0\./)) {
      return {
        permissionDecision: 'deny',
        reason: 'Access to internal networks blocked for security',
      }
    }
    return { permissionDecision: 'ask' }
  }

  // Allow test execution
  if (
    tool === 'shell' &&
    (args?.command?.includes('test') ||
      args?.command?.includes('pytest') ||
      args?.command?.includes('lint'))
  ) {
    return { permissionDecision: 'allow' }
  }

  // Default: ask user for unknown operations
  return { permissionDecision: 'ask' }
}

// Main execution
async function main() {
  try {
    const input = await readStdin()
    const payload = JSON.parse(input)
    const decision = makeDecision(payload)

    // Output decision as JSON to stdout
    stdout.write(JSON.stringify(decision))

    // Log to stderr for debugging (doesn't affect harness)
    if (process.env.HOOK_DEBUG === 'true') {
      stderr.write(`[preToolUse] Decision: ${JSON.stringify(decision)}\n`)
    }
  } catch (error) {
    // On error, default to asking user (safe fallback)
    stdout.write(
      JSON.stringify({
        permissionDecision: 'ask',
        reason: `Hook error: ${error.message}`,
      }),
    )
  }
}

void main()
