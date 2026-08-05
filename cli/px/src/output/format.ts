import type { LoadedConfig } from '../config/loader.js';
import type { PxConfig, AgentConfig, HookConfig } from '../config/schema.js';

function formatAgents(agents: Record<string, AgentConfig>): string {
  const lines: string[] = [];
  for (const [name, agent] of Object.entries(agents)) {
    lines.push(`  ${name}`);
    lines.push(`    endpoint: ${agent.endpoint}`);
    lines.push(`    tools:    ${agent.tools.join(', ')}`);
    lines.push(`    async:    ${agent.async}`);
    lines.push(`    timeout:  ${agent.timeout}ms`);
  }
  return lines.join('\n');
}

function formatHooks(config: PxConfig): string {
  if (!config.hooks) return '  (none)';
  const lines: string[] = [];
  for (const [event, hook] of Object.entries(config.hooks) as [string, HookConfig][]) {
    lines.push(
      `  ${event} → ${hook.agent}.${hook.tool}${hook.filter ? ` (filter: ${hook.filter})` : ''}${hook.async ? ' [async]' : ''}`,
    );
  }
  return lines.join('\n');
}

export function formatConfig(loaded: LoadedConfig): string {
  const { config, sources } = loaded;
  const lines: string[] = [];
  lines.push('px config — resolved configuration');
  lines.push('');
  lines.push('Sources (precedence low → high):');
  for (const s of sources) lines.push(`  ${s}`);
  lines.push('');
  lines.push('Agents:');
  lines.push(formatAgents(config.agents as Record<string, AgentConfig>));
  lines.push('');
  if (config.slack) {
    lines.push('Slack:');
    lines.push(`  channel:  ${config.slack.channel ?? '(not set)'}`);
    lines.push(`  webhook: ${config.slack.webhook ? '(set)' : '(not set)'}`);
    lines.push('');
  }
  lines.push('Hooks:');
  lines.push(formatHooks(config));
  return lines.join('\n');
}

export function formatAgentList(config: PxConfig): string {
  const lines: string[] = [];
  lines.push('px agents — available agents and tools');
  lines.push('');
  for (const [name, agent] of Object.entries(config.agents) as [string, AgentConfig][]) {
    lines.push(`${name}`);
    lines.push(`  endpoint: ${agent.endpoint}`);
    lines.push(`  tools:    ${agent.tools.join(', ')}`);
    lines.push(`  async:    ${agent.async}`);
    lines.push(`  timeout:  ${agent.timeout}ms`);
    lines.push('');
  }
  if (config.hooks) {
    lines.push('Hook mapping:');
    for (const [event, hook] of Object.entries(config.hooks) as [string, HookConfig][]) {
      lines.push(
        `  ${event} → ${hook.agent}.${hook.tool}${hook.filter ? ` (filter: ${hook.filter})` : ''}`,
      );
    }
  }
  return lines.join('\n');
}

export interface HealthResult {
  agent: string;
  endpoint: string;
  status: 'ok' | 'down' | 'error';
  detail?: string;
}

export function formatHealthResult(results: HealthResult[]): string {
  const lines: string[] = [];
  lines.push('px health — agent health check');
  lines.push('');
  let ok = 0;
  let down = 0;
  let err = 0;
  for (const r of results) {
    const icon = r.status === 'ok' ? '✓' : r.status === 'down' ? '✗' : '!';
    lines.push(`  ${icon} ${r.agent.padEnd(16)} ${r.endpoint}`);
    if (r.detail) lines.push(`                    ${r.detail}`);
    if (r.status === 'ok') ok++;
    else if (r.status === 'down') down++;
    else err++;
  }
  lines.push('');
  lines.push(
    `  ${ok} ok, ${down} down, ${err} error (${results.length} total)`,
  );
  return lines.join('\n');
}
