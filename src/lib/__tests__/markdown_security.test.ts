import { describe, it, expect } from 'vitest';
import { simpleMarkdownToHtml } from '../markdown';

describe('Markdown Security', () => {
  it('should escape HTML tags to prevent XSS', () => {
    const input = '<script>alert("xss")</script>';
    const output = simpleMarkdownToHtml(input);
    expect(output).not.toContain('<script>');
    expect(output).toContain('&lt;script&gt;');
  });

  it('should escape HTML attributes to prevent XSS', () => {
    const input = '<img src="x" onerror="alert(\'xss\')">';
    const output = simpleMarkdownToHtml(input);
    expect(output).not.toContain('onerror="');
    expect(output).toContain('onerror=&quot;');
    expect(output).toContain('&lt;img');
  });

  it('should sanitize link protocols to prevent XSS', () => {
    const input = '<img src="x" onerror="alert(\'xss\')">';
    const output = simpleMarkdownToHtml(input);
    expect(output).not.toContain('onerror="');
    expect(output).toContain('onerror=&quot;');
    expect(output).toContain('&lt;img');
  });

  it('should sanitize link protocols to prevent javascript: XSS', () => {
    const input = '[Click me](javascript:alert("xss"))';
    const output = simpleMarkdownToHtml(input);
    expect(output).not.toContain('href="javascript:');
    // It should either remove the href, or prefix it, or just use a safe fallback
    expect(output).toContain('href="#"');
  });

  it('should sanitize link protocols to prevent javascript: XSS with whitespace', () => {
    const input = '[x](   JaVaScRiPt:alert(1))';
    const output = simpleMarkdownToHtml(input);
    expect(output).not.toContain('href="   JaVaScRiPt:');
    expect(output).toContain('href="#"');
  });

  it('should sanitize link protocols to prevent javascript: XSS with control chars', () => {
    const input = '[x](\njavascript:alert(1))';
    const output = simpleMarkdownToHtml(input);
    expect(output).not.toContain('href="\\njavascript:');
    expect(output).toContain('href="#"');
  });

  it('should sanitize link protocols to prevent javascript: XSS with mixed case', () => {
    const input = '[x](JaVaScRiPt:alert(1))';
    const output = simpleMarkdownToHtml(input);
    expect(output).not.toContain('href="JaVaScRiPt:');
    expect(output).toContain('href="#"');
  });

  it('should allow safe link protocols', () => {
    const input = '[Google](https://google.com)';
    const output = simpleMarkdownToHtml(input);
    expect(output).toContain('href="https://google.com"');
  });

  it('should allow relative links', () => {
    const input = '[Internal](/dashboard)';
    const output = simpleMarkdownToHtml(input);
    expect(output).toContain('href="/dashboard"');
  });

  it('should prevent protocol-relative URLs', () => {
    const input = '[Internal](//google.com/a)';
    const output = simpleMarkdownToHtml(input);
    expect(output).toContain('href="#"');
    expect(output).not.toContain('href="//google.com/a"');
  });

  it('should handle fragment-only links safely', () => {
    const input = '[Section](#section)';
    const output = simpleMarkdownToHtml(input);
    // Fragments are considered safe in this implementation
    expect(output).toContain('href="#section"');
  });
});