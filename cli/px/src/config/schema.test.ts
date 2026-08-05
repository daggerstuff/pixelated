import { describe, it, expect } from 'vitest';
import {
  AgentConfigSchema,
  SlackConfigSchema,
  HookConfigSchema,
  HookEventSchema,
  PxConfigSchema,
} from './schema.js';

describe('AgentConfigSchema', () => {
  it('accepts a valid agent config', () => {
    const valid = {
      endpoint: 'http://localhost:2000',
      tools: ['review', 'get_worktree'],
    };
    const result = AgentConfigSchema.parse(valid);
    expect(result.endpoint).toBe('http://localhost:2000');
    expect(result.tools).toEqual(['review', 'get_worktree']);
    expect(result.async).toBe(false);
    expect(result.timeout).toBe(30000);
  });

  it('applies defaults for async and timeout', () => {
    const result = AgentConfigSchema.parse({
      endpoint: 'http://localhost:2000',
      tools: [],
    });
    expect(result.async).toBe(false);
    expect(result.timeout).toBe(30000);
  });

  it('accepts custom async and timeout', () => {
    const result = AgentConfigSchema.parse({
      endpoint: 'http://localhost:2000',
      tools: ['score'],
      async: true,
      timeout: 5000,
    });
    expect(result.async).toBe(true);
    expect(result.timeout).toBe(5000);
  });

  it('rejects invalid endpoint (not a URL)', () => {
    expect(() =>
      AgentConfigSchema.parse({ endpoint: 'not-a-url', tools: [] }),
    ).toThrow();
  });

  it('rejects missing endpoint', () => {
    expect(() =>
      AgentConfigSchema.parse({ tools: [] }),
    ).toThrow();
  });

  it('rejects missing tools', () => {
    expect(() =>
      AgentConfigSchema.parse({ endpoint: 'http://localhost:2000' }),
    ).toThrow();
  });

  it('rejects non-positive timeout', () => {
    expect(() =>
      AgentConfigSchema.parse({
        endpoint: 'http://localhost:2000',
        tools: [],
        timeout: 0,
      }),
    ).toThrow();

    expect(() =>
      AgentConfigSchema.parse({
        endpoint: 'http://localhost:2000',
        tools: [],
        timeout: -100,
      }),
    ).toThrow();
  });

  it('rejects non-integer timeout', () => {
    expect(() =>
      AgentConfigSchema.parse({
        endpoint: 'http://localhost:2000',
        tools: [],
        timeout: 1.5,
      }),
    ).toThrow();
  });
});

describe('SlackConfigSchema', () => {
  it('accepts empty object (all optional)', () => {
    const result = SlackConfigSchema.parse({});
    expect(result.webhook).toBeUndefined();
    expect(result.channel).toBeUndefined();
  });

  it('accepts webhook and channel', () => {
    const result = SlackConfigSchema.parse({
      webhook: 'https://hooks.slack.com/services/xxx',
      channel: '#px-agent-results',
    });
    expect(result.webhook).toBe('https://hooks.slack.com/services/xxx');
    expect(result.channel).toBe('#px-agent-results');
  });

  it('rejects invalid webhook URL', () => {
    expect(() =>
      SlackConfigSchema.parse({ webhook: 'not-a-url' }),
    ).toThrow();
  });
});

describe('HookConfigSchema', () => {
  it('accepts required fields', () => {
    const result = HookConfigSchema.parse({
      agent: 'content',
      tool: 'audit_clinical_corpus',
    });
    expect(result.agent).toBe('content');
    expect(result.tool).toBe('audit_clinical_corpus');
    expect(result.filter).toBeUndefined();
    expect(result.async).toBeUndefined();
  });

  it('accepts optional filter and async', () => {
    const result = HookConfigSchema.parse({
      agent: 'content',
      tool: 'audit_clinical_corpus',
      filter: 'scenarios/**',
      async: true,
    });
    expect(result.filter).toBe('scenarios/**');
    expect(result.async).toBe(true);
  });

  it('rejects missing agent', () => {
    expect(() =>
      HookConfigSchema.parse({ tool: 'audit' }),
    ).toThrow();
  });

  it('rejects missing tool', () => {
    expect(() =>
      HookConfigSchema.parse({ agent: 'content' }),
    ).toThrow();
  });
});

describe('HookEventSchema', () => {
  it('accepts all valid events', () => {
    const events = ['pre-commit', 'pre-push', 'post-merge', 'pr-open', 'pr-merge'];
    for (const event of events) {
      expect(HookEventSchema.parse(event)).toBe(event);
    }
  });

  it('rejects invalid event', () => {
    expect(() => HookEventSchema.parse('pre-checkout')).toThrow();
  });
});

describe('PxConfigSchema', () => {
  const validConfig = {
    agents: {
      advisor: {
        endpoint: 'http://localhost:2000',
        tools: ['review'],
      },
    },
  };

  it('accepts config with agents only', () => {
    const result = PxConfigSchema.parse(validConfig);
    expect(result.agents).toHaveProperty('advisor');
    expect(result.slack).toBeUndefined();
    expect(result.hooks).toBeUndefined();
  });

  it('accepts config with slack and hooks', () => {
    const result = PxConfigSchema.parse({
      ...validConfig,
      slack: { channel: '#test' },
      hooks: {
        'pre-commit': { agent: 'advisor', tool: 'review' },
      },
    });
    expect(result.slack?.channel).toBe('#test');
    expect(result.hooks).toHaveProperty('pre-commit');
  });

  it('rejects config without agents', () => {
    expect(() => PxConfigSchema.parse({})).toThrow();
  });

  it('accepts empty agents record (schema allows it, loader catches it)', () => {
    const result = PxConfigSchema.parse({ agents: {} });
    expect(Object.keys(result.agents)).toHaveLength(0);
  });
});
