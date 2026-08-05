import { describe, it, expect } from 'vitest';
import {
  formatInteractiveResponse,
  formatAsyncResponse,
  formatJsonResponse,
} from './response.js';

describe('formatInteractiveResponse', () => {
  it('formats string data', () => {
    expect(formatInteractiveResponse('hello')).toBe('hello');
  });

  it('formats number data', () => {
    expect(formatInteractiveResponse(42)).toBe('42');
  });

  it('formats boolean data', () => {
    expect(formatInteractiveResponse(true)).toBe('true');
  });

  it('formats null', () => {
    expect(formatInteractiveResponse(null)).toBe('null');
  });

  it('formats empty array', () => {
    expect(formatInteractiveResponse([])).toBe('[]');
  });

  it('formats array of strings', () => {
    const result = formatInteractiveResponse(['a', 'b', 'c']);
    expect(result).toBe('a\nb\nc');
  });

  it('formats empty object', () => {
    expect(formatInteractiveResponse({})).toBe('{}');
  });

  it('formats flat object', () => {
    const result = formatInteractiveResponse({ name: 'test', score: 95, active: true });
    expect(result).toContain('name: test');
    expect(result).toContain('score: 95');
    expect(result).toContain('active: true');
  });

  it('formats nested object', () => {
    const result = formatInteractiveResponse({
      outer: { inner: 'value' },
    });
    expect(result).toContain('outer:');
    expect(result).toContain('inner: value');
  });

  it('formats object with null value', () => {
    const result = formatInteractiveResponse({ key: null });
    expect(result).toContain('key: null');
  });
});

describe('formatAsyncResponse', () => {
  it('formats with task ID and channel', () => {
    const result = formatAsyncResponse('task-123', '#px-results');
    expect(result).toContain('Queued');
    expect(result).toContain('task-123');
    expect(result).toContain('#px-results');
  });

  it('uses default channel when not provided', () => {
    const result = formatAsyncResponse('task-456');
    expect(result).toContain('#slack-channel');
  });
});

describe('formatJsonResponse', () => {
  it('outputs JSON string', () => {
    const result = formatJsonResponse({ key: 'value' });
    expect(JSON.parse(result)).toEqual({ key: 'value' });
  });

  it('pretty-prints with 2-space indent', () => {
    const result = formatJsonResponse({ a: 1 });
    expect(result).toContain('  "a": 1');
  });
});
