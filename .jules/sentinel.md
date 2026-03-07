## 2025-05-15 - NoSQL Injection via Express Query Parameters
**Vulnerability:** Express `req.query` can be parsed as an object if an attacker sends parameters like `?status[$ne]=null`. If this object is passed directly into a MongoDB filter (e.g., `Model.find({ status })`), it becomes a NoSQL operator injection, allowing attackers to bypass filters.
**Learning:** Standard TypeScript type assertions like `as string` do not provide runtime protection against this. Explicit runtime type checking or sanitization is required.
**Prevention:** Use a dedicated sanitization utility like `ensureString` to force query parameters to be strings before using them in database filters. Abstracting this into a shared utility ensures consistency across the API.
