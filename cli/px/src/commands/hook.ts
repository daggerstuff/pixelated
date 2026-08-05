import { Command } from 'commander';
import { execSync } from 'node:child_process';
import { loadConfig, findAgent, validateTool } from '../config/loader.js';
import type { PxConfig, HookConfig } from '../config/schema.js';
import { callAgent, HttpError, TimeoutError } from '../client/http.js';
import { formatInteractiveResponse, formatAsyncResponse } from '../output/response.js';

/**
 * `px hook <event>` — internal command called by git hook scripts.
 *
 * Flow:
 * 1. Load config, get hook config for the event
 * 2. If no hook configured → silent exit 0
 * 3. Extract git context (staged files, unpushed commits, etc.)
 * 4. Apply filter (glob match) if configured — no match → silent exit 0
 * 5. Call agent with tool, passing context as body
 * 6. All errors → warning to stderr, exit 0 (fail-open)
 */
export function registerHookCommand(program: Command): void {
  program
    .command('hook <event>')
    .description('Run a git hook event (called by hook scripts)')
    .option('--pr <url>', 'PR URL (for pr-open / pr-merge events)')
    .action(async (event: string, opts: { pr?: string }) => {
      await runHook(event, opts);
    });
}

async function runHook(
  event: string,
  opts: { pr?: string },
): Promise<void> {
  // 1. Load config — fail-open if config unavailable
  let config: PxConfig;
  try {
    const loaded = loadConfig();
    config = loaded.config;
  } catch {
    process.exit(0);
  }

  // 2. Get hook config for this event
  const hookConfig: HookConfig | undefined = config.hooks?.[event];
  if (!hookConfig) {
    // No hook configured for this event → silent exit
    process.exit(0);
  }

  // 3. Resolve agent + validate tool — fail-open if misconfigured
  let agent;
  try {
    agent = findAgent(config, hookConfig.agent);
    validateTool(agent, hookConfig.tool);
  } catch (e) {
    console.error(
      `px: hook ${event} misconfigured — ${e instanceof Error ? e.message : 'unknown'}`,
    );
    process.exit(0);
  }

  const tool = hookConfig.tool;
  const isAsync = hookConfig.async ?? agent.async;

  // 4. Extract git context based on event type
  const context = extractGitContext(event, opts);

  // 5. Apply filter if configured
  if (hookConfig.filter) {
    const files = (context as { files?: string[] }).files;
    if (!files || files.length === 0) {
      // No files to filter → silent exit
      process.exit(0);
    }
    const matched = matchGlob(files, hookConfig.filter);
    if (!matched) {
      // No matching files → silent exit
      process.exit(0);
    }
  }

  // 6. Build request body from git context
  const body: Record<string, unknown> = { ...context, event };

  // 7. Call agent — fail-open on any error
  try {
    const res = await callAgent({
      endpoint: agent.endpoint,
      tool,
      body,
      timeoutMs: agent.timeout,
    });

    if (isAsync) {
      const taskId =
        (res.data as Record<string, unknown>)?.['task_id'] as string ??
        'unknown';
      const channel = config.slack?.channel;
      console.log(formatAsyncResponse(taskId, channel));
    } else {
      console.log(formatInteractiveResponse(res.data));
    }
  } catch (e) {
    // Fail-open: print warning to stderr, exit 0
    if (e instanceof TimeoutError) {
      console.error(
        `px: hook ${event} — request timed out after ${agent.timeout}ms`,
      );
    } else if (e instanceof HttpError) {
      console.error(`px: hook ${event} — ${e.message}`);
    } else {
      console.error(
        `px: hook ${event} failed — ${e instanceof Error ? e.message : 'unknown error'}`,
      );
    }
    process.exit(0);
  }
}

/**
 * Extract git context based on the hook event type.
 * Returns an object with relevant fields (files, commits, branch, prUrl).
 */
function extractGitContext(
  event: string,
  opts: { pr?: string },
): Record<string, unknown> {
  const context: Record<string, unknown> = {};

  try {
    switch (event) {
      case 'pre-commit': {
        // Staged files
        const output = execSync('git diff --cached --name-only', {
          encoding: 'utf-8',
        });
        context['files'] = output
          .trim()
          .split('\n')
          .filter(Boolean);
        break;
      }

      case 'pre-push': {
        // Current branch
        const branch = execSync('git rev-parse --abbrev-ref HEAD', {
          encoding: 'utf-8',
        }).trim();
        context['branch'] = branch;

        // Unpushed commits
        try {
          const commits = execSync(
            `git rev-list --reverse origin/${branch}..HEAD`,
            { encoding: 'utf-8' },
          );
          context['commits'] = commits
            .trim()
            .split('\n')
            .filter(Boolean);
        } catch {
          // Remote ref may not exist (first push) — use all commits
          const allCommits = execSync('git rev-list --reverse HEAD', {
            encoding: 'utf-8',
          });
          context['commits'] = allCommits
            .trim()
            .split('\n')
            .filter(Boolean);
        }

        // Also grab changed files for context
        try {
          const files = execSync(
            `git diff --name-only origin/${branch}..HEAD`,
            { encoding: 'utf-8' },
          );
          context['files'] = files
            .trim()
            .split('\n')
            .filter(Boolean);
        } catch {
          // Non-fatal
        }
        break;
      }

      case 'post-merge': {
        // Just triggered after merge — report branch
        const branch = execSync('git rev-parse --abbrev-ref HEAD', {
          encoding: 'utf-8',
        }).trim();
        context['branch'] = branch;
        break;
      }

      case 'pr-open': {
        // PR URL from --pr flag or env
        const prUrl = opts.pr ?? process.env['GITHUB_PR_URL'] ?? '';
        context['prUrl'] = prUrl;

        // Branch info
        const branch = execSync('git rev-parse --abbrev-ref HEAD', {
          encoding: 'utf-8',
        }).trim();
        context['branch'] = branch;
        break;
      }

      case 'pr-merge': {
        // Files changed in the merge commit
        const output = execSync('git diff --name-only HEAD~1..HEAD', {
          encoding: 'utf-8',
        });
        context['files'] = output
          .trim()
          .split('\n')
          .filter(Boolean);
        break;
      }

      default:
        // Unknown event — no context
        break;
    }
  } catch {
    // Git command failed — proceed with whatever context we have
  }

  return context;
}

/**
 * Match a list of file paths against a glob pattern.
 * Supports: * (single segment), ** (multi-segment), ? (single char)
 * Multiple patterns separated by | are OR'd.
 *
 * @example
 * matchGlob(['scenarios/foo.yml', 'src/bar.ts'], 'scenarios/**') // true
 * matchGlob(['src/bar.ts'], 'scenarios/**') // false
 * matchGlob(['scenarios/foo.yml', 'bar.clinical.yml'], 'scenarios/**|**/*.clinical.yml') // true
 */
function matchGlob(files: string[], pattern: string): boolean {
  // Split on | for multiple patterns
  const patterns = pattern.split('|');

  for (const glob of patterns) {
    const regex = globToRegex(glob.trim());
    if (files.some((f) => regex.test(f))) {
      return true;
    }
  }

  return false;
}

/**
 * Convert a glob pattern to a RegExp.
 * Handles: ** → .*, * → [^/]*, ? → ., . → \.
 */
function globToRegex(glob: string): RegExp {
  let result = '';
  let i = 0;

  while (i < glob.length) {
    const char = glob[i];

    if (char === '*' && glob[i + 1] === '*') {
      // ** → match any path segments (including /)
      result += '.*';
      i += 2;
      // Skip trailing / if present (scenarios/** → scenarios/.*)
      if (glob[i] === '/') {
        // Include the / in the match — scenarios/.* matches scenarios/foo.yml
        i++; // Skip the / — .* already covers it
      }
    } else if (char === '*') {
      // * → match any chars except /
      result += '[^/]*';
      i++;
    } else if (char === '?') {
      // ? → match single char except /
      result += '[^/]';
      i++;
    } else if (char === '.') {
      result += '\\.';
      i++;
    } else {
      result += char;
      i++;
    }
  }

  return new RegExp(`^${result}$`);
}
