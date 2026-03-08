## 2025-03-24 - [Markdown XSS Vulnerability]
**Vulnerability:** Cross-Site Scripting (XSS) via unsanitized Markdown rendering.
**Learning:** The `simpleMarkdownToHtml` utility used regex for Markdown conversion but lacked HTML escaping, allowing raw HTML tags and `javascript:` links to be executed when rendered with `dangerouslySetInnerHTML`.
**Prevention:** Always escape HTML special characters before applying Markdown-to-HTML transformations and validate URL protocols to ensure only safe protocols (http, https, etc.) are used in links.

## 2025-03-25 - [Broken Access Control via Placeholder Middleware]
**Vulnerability:** Authorization bypass due to "pass-through" placeholder middleware.
**Learning:** Security-critical routes in the Express API used stubbed middleware (`(req, res, next) => next()`) which effectively disabled all RBAC/ABAC checks, even though the routes were intended to be protected.
**Prevention:** Never use stubbed/placeholder middleware in production-facing security-critical code. Ensure all routes have actual, verified authorization checks implemented at the route level to provide defense-in-depth.
