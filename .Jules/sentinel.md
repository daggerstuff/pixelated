## 2026-04-11 - Fix XSS in ChatMessage | Vulnerability: Unsanitized markdown-to-html rendered via dangerouslySetInnerHTML | Learning: Custom markdown parsers can have edge cases that bypass XSS protections | Prevention: Always use isomorphic-dompurify or dompurify when setting inner HTML, even after custom markdown parsing

## 2026-04-11 - Fix XSS in Astro Session Script | Vulnerability: Unescaped HTML control chars injected via set:html with JSON.stringify | Learning: JSON.stringify is unsafe for inline script blocks without escaping | Prevention: Always use replace(/</g, "\u003c").replace(/>/g, "\u003e") for JSON data within set:html

## 2026-04-15 - Fix XSS in Training Session Astro View | Vulnerability: Unsanitized JSON stringification inside script tags using set:html | Learning: JSON.stringify does not escape HTML control characters like < or > which can allow breakout of script tags leading to XSS | Prevention: Always escape HTML control characters in JSON.stringify when injecting into script tags, e.g., replacing < with \u003c.

## 2026-04-17 - Missing Authentication on Strategy Endpoints | Vulnerability: Unauthenticated access to sensitive business strategy dashboard and operations | Learning: New route files must explicitly import and use authentication middleware if not globally applied in the router | Prevention: Always review endpoint definitions for missing authenticateToken middleware

## 2026-04-18 - Fix XSS in Head.astro JSON-LD | Vulnerability: Unescaped HTML control chars injected via set:html with JSON.stringify | Learning: JSON.stringify is unsafe for inline script blocks without escaping | Prevention: Always use replace(/</g, '<').replace(/>/g, '>') for JSON data within set:html

## 2026-04-26 - Fix XSS in BlogLayout JSON-LD | Vulnerability: Unescaped HTML control chars injected via set:html with JSON.stringify | Learning: JSON.stringify is unsafe for inline script blocks without escaping | Prevention: Always use replace(/</g, '\u003c').replace(/>/g, '\u003e') for JSON data within set:html

## 2026-04-27 - Fix XSS in About.astro | Vulnerability: Unescaped HTML control chars injected via set:html with JSON.stringify | Learning: JSON.stringify is unsafe for inline script blocks without escaping | Prevention: Always use replace(/</g, '\u003c').replace(/>/g, '\u003e') for JSON data within set:html
