## 2025-03-24 - [Markdown XSS Vulnerability]

**Vulnerability:** Cross-Site Scripting (XSS) via unsanitized Markdown rendering.
**Learning:** The `simpleMarkdownToHtml` utility used regex for Markdown conversion but lacked HTML escaping, allowing raw HTML tags and `javascript:` links to be executed when rendered with `dangerouslySetInnerHTML`.
**Prevention:** Always escape HTML special characters before applying Markdown-to-HTML transformations and validate URL protocols to ensure only safe protocols (http, https, etc.) are used in links.
