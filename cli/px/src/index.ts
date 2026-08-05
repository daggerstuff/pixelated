import { Command, Option } from 'commander';
import { loadConfig, findAgent, validateTool } from './config/loader.js';
import type { PxConfig } from './config/schema.js';
import { callAgent, HttpError, TimeoutError } from './client/http.js';
import { formatInteractiveResponse, formatAsyncResponse, formatJsonResponse } from './output/response.js';
import { registerConfigCommand } from './commands/config.js';
import { registerListCommand } from './commands/list.js';
import { registerHealthCommand } from './commands/health.js';
import { registerInitCommand } from './commands/init.js';
import { registerHookCommand } from './commands/hook.js';

const program = new Command();

program
  .name('px')
  .description('Pixelated Empathy agent CLI')
  .version('0.1.0');

// Global commands
registerConfigCommand(program);
registerListCommand(program);
registerHealthCommand(program);
registerInitCommand(program);

// Dynamic agent commands — auto-generated from config
function registerAgentCommands(): void {
  let config: PxConfig;
  try {
    const loaded = loadConfig();
    config = loaded.config;
  } catch {
    // Config may not exist yet; global commands still work
    return;
  }

  for (const [agentName, agentConfig] of Object.entries(config.agents) as [string, import('./config/schema.js').AgentConfig][]) {
    const agentCmd = program
      .command(agentName)
      .description(`Agent: ${agentName} (${agentConfig.endpoint})`);

    for (const tool of agentConfig.tools) {
      agentCmd
        .command(tool)
        .description(`Call ${agentName}.${tool}`)
        .allowUnknownOption()
        .addOption(new Option('--json', 'output raw JSON response'))
        .addOption(new Option('--dry-run', 'print request, do not send'))
        .addOption(new Option('--verbose', 'print HTTP details to stderr'))
        .addOption(new Option('--async', 'force async mode'))
        .addOption(new Option('--sync', 'force interactive mode'))
        .addOption(new Option('--timeout <ms>', 'override timeout'))
        .action(async (opts: Record<string, unknown>) => {
          await runAgentCommand(agentName, tool, opts);
        });
    }
  }
}

async function runAgentCommand(
  agentName: string,
  tool: string,
  opts: Record<string, unknown>,
): Promise<void> {
  const loaded = loadConfig();
  const config = loaded.config;
  const agent = findAgent(config, agentName);
  validateTool(agent, tool);

  // Determine mode: --async flag forces async, --sync forces interactive,
  // otherwise use agent config default
  const forceAsync = opts['async'] === true;
  const forceSync = opts['sync'] === true;
  const isAsync = forceAsync ? true : forceSync ? false : agent.async;
  const timeoutMs = opts['timeout']
    ? parseInt(opts['timeout'] as string, 10)
    : agent.timeout;

  // Build request body from unknown flags (commander passes them as properties)
  const body: Record<string, unknown> = {};
  const knownFlags = new Set(['json', 'dryRun', 'verbose', 'async', 'sync', 'timeout']);
  for (const [key, val] of Object.entries(opts)) {
    if (!knownFlags.has(key) && val !== undefined) {
      body[key] = val;
    }
  }

  // Dry-run: print intent and exit
  if (opts['dryRun'] === true) {
    const payload = {
      method: 'POST',
      url: `${agent.endpoint.replace(/\/$/, '')}/eve/v1/${tool}`,
      agent: agentName,
      tool,
      async: isAsync,
      timeout: timeoutMs,
      body,
    };
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  // Verbose: print HTTP details to stderr
  if (opts['verbose'] === true) {
    process.stderr.write(`POST ${agent.endpoint}/eve/v1/${tool}\n`);
    process.stderr.write(`  timeout: ${timeoutMs}ms\n`);
    process.stderr.write(`  async: ${isAsync}\n`);
    process.stderr.write(`  body: ${JSON.stringify(body)}\n`);
  }

  try {
    const res = await callAgent({
      endpoint: agent.endpoint,
      tool,
      body,
      timeoutMs,
    });

    if (opts['json'] === true) {
      console.log(formatJsonResponse(res.data));
      return;
    }

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
    if (e instanceof TimeoutError) {
      console.error(`px: ${e.message}`);
      console.error(`  endpoint: ${e.endpoint}`);
      console.error(`  hint: run \`px health\` to check agent status`);
      process.exit(isAsync ? 0 : 1);
    }
    if (e instanceof HttpError) {
      console.error(`px: ${e.message}`);
      if (e.status > 0) console.error(`  status: ${e.status}`);
      console.error(`  endpoint: ${e.endpoint}`);
      console.error(`  hint: run \`px health\` to check agent status`);
      process.exit(isAsync ? 0 : 1);
    }
    // Unknown error
    console.error(
      `px: ${e instanceof Error ? e.message : 'unknown error'}`,
    );
    process.exit(isAsync ? 0 : 1);
  }
}

registerAgentCommands();

program.parse();
