## 2025-05-15 - [XSS in Custom Markdown Parser]
**Vulnerability:** The `simpleMarkdownToHtml` function in `src/lib/markdown.ts` was performing direct string replacements to convert markdown to HTML without escaping input or sanitizing URLs, leading to stored/reflected XSS.
**Learning:** Even "simple" custom markdown parsers require a security-first pipeline: escape -> transform -> sanitize. Directly using `dangerouslySetInnerHTML` with such functions is a major risk.
**Prevention:** Always use a robust `escapeHtml` utility before any custom regex-based HTML generation. Implement a `sanitizeUrl` whitelist (http, https, mailto, tel, relative) for all user-provided links.
