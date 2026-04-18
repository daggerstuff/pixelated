import { describe, it, expect, vi } from 'vitest';
import { previewTemplate } from './template';

// Mock logger to prevent console noise
vi.mock('./logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }
}));

describe('template utility', () => {
  describe('previewTemplate', () => {
    it('renders template correctly with data', async () => {
      const html = await previewTemplate('test-template', { key: 'value' });
      expect(html).toContain('<h1>Template: test-template</h1>');
      expect(html).toContain('"key": "value"');
    });

    it('renders template correctly with empty data', async () => {
      const html = await previewTemplate('empty-template');
      expect(html).toContain('<h1>Template: empty-template</h1>');
      expect(html).toContain('{}');
    });
  });
});
