import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig, findAgent, validateTool } from './loader.js';
import type { PxConfig, AgentConfig } from './schema.js';

// Helper: create a temp git repo with config
function createTempRepo(config: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'px-test-'));
  mkdirSync(join(dir, '.git'), { recursive: true });
  mkdirSync(join(dir, 'agents'), { recursive: true });
  writeFileSync(
    join(dir, 'agents', 'px.config.json'),
    JSON.stringify(config, null, 2),
  );
  return dir;
}

const baseConfig: Record<string, unknown> = {
  agents: {
    advisor: {
      endpoint: 'http://advisor:2000',
      tools: ['review', 'get_worktree'],
      async: false,
      timeout: 30000,
    },
    content: {
      endpoint: 'http://content:2000',
      tools: ['audit_clinical_corpus'],
      async: false,
      timeout: 30000,
    },
  },
  hooks: {
    'pre-commit': { agent: 'content', tool: 'audit_clinical_corpus' },
  },
};

describe('loadConfig', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempRepo(baseConfig);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('loads default config from agents/px.config.json', () => {
    const { config, sources } = loadConfig(tempDir);
    expect(config.agents).toHaveProperty('advisor');
    expect(config.agents).toHaveProperty('content');
    expect(sources.length).toBeGreaterThanOrEqual(1);
    expect(sources[0]).toContain('agents/px.config.json');
  });

  it('throws if no repo root found', () => {
    const noGitDir = mkdtempSync(join(tmpdir(), 'px-nogit-'));
    expect(() => loadConfig(noGitDir)).toThrow('repo root');
    rmSync(noGitDir, { recursive: true, force: true });
  });

  it('throws if config file missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'px-noconf-'));
    mkdirSync(join(dir, '.git'), { recursive: true });
    expect(() => loadConfig(dir)).toThrow('config not found');
    rmSync(dir, { recursive: true, force: true });
  });

  it('applies repo-local override (.px/config.json)', () => {
    // Create override
    mkdirSync(join(tempDir, '.px'), { recursive: true });
    writeFileSync(
      join(tempDir, '.px', 'config.json'),
      JSON.stringify({
        agents: {
          advisor: { endpoint: 'http://override:3000' },
        },
      }),
    );

    const { config, sources } = loadConfig(tempDir);
    expect(config.agents.advisor!.endpoint).toBe('http://override:3000');
    expect(sources.length).toBe(2);
  });

  it('merges hooks from override', () => {
    mkdirSync(join(tempDir, '.px'), { recursive: true });
    writeFileSync(
      join(tempDir, '.px', 'config.json'),
      JSON.stringify({
        hooks: {
          'pre-push': { agent: 'advisor', tool: 'review' },
        },
      }),
    );

    const { config } = loadConfig(tempDir);
    expect(config.hooks).toHaveProperty('pre-commit');
    expect(config.hooks).toHaveProperty('pre-push');
  });
});

describe('findAgent', () => {
  const config: PxConfig = {
    agents: {
      advisor: {
        endpoint: 'http://advisor:2000',
        tools: ['review'],
        async: false,
        timeout: 30000,
      },
    },
  };

  it('returns agent config when found', () => {
    const agent = findAgent(config, 'advisor');
    expect(agent.endpoint).toBe('http://advisor:2000');
  });

  it('throws with available agent list when not found', () => {
    expect(() => findAgent(config, 'nonexistent')).toThrow(
      /unknown agent.*Available:.*advisor/,
    );
  });
});

describe('validateTool', () => {
  const agent: AgentConfig = {
    endpoint: 'http://advisor:2000',
    tools: ['review', 'get_worktree'],
    async: false,
    timeout: 30000,
  };

  it('passes when tool exists', () => {
    expect(() => validateTool(agent, 'review')).not.toThrow();
    expect(() => validateTool(agent, 'get_worktree')).not.toThrow();
  });

  it('throws with available tools when tool not found', () => {
    expect(() => validateTool(agent, 'nonexistent')).toThrow(
      /does not expose tool.*Available:.*review.*get_worktree/,
    );
  });
});
