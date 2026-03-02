## 2026-03-02 - Astro 5 Content Layer: render() vs .body
**Learning:** In Astro 5.x with the glob loader, calling `post.render()` on every collection entry is extremely expensive (O(n) compilation). The raw Markdown content is directly available via the `.body` property, which is significantly faster for non-UI tasks like search indexing.
**Action:** Always prefer `.body` or `.data.description` for indexing, analysis, or summaries to avoid the overhead of full component rendering.
