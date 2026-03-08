import { describe, it, expect } from "vitest";
import { simpleMarkdownToHtml } from "./markdown";

describe("simpleMarkdownToHtml security", () => {
  it("should not allow XSS via javascript links", () => {
    const maliciousMarkdown = '[click me](javascript:alert("XSS"))';
    const html = simpleMarkdownToHtml(maliciousMarkdown);
    // It should either escape the javascript: or not render it as a link
    expect(html).not.toContain('href="javascript:alert("XSS")"');
    expect(html).toContain("<span>click me</span>");
  });

  it("should not allow XSS via raw HTML", () => {
    const maliciousMarkdown = "<img src=x onerror=alert(1)>";
    const html = simpleMarkdownToHtml(maliciousMarkdown);
    // The raw HTML should be escaped
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("should not allow XSS via nested structures", () => {
    const maliciousMarkdown = "[**bold**](javascript:alert(1))";
    const html = simpleMarkdownToHtml(maliciousMarkdown);
    expect(html).not.toContain('href="javascript:alert(1)"');
    expect(html).toContain("<span><strong>bold</strong></span>");
  });
});
