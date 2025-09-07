# Potentially Unused Packages Analysis

*Generated: 2025-09-07*

## 🔍 **Potentially Unused Packages from Previous Analysis**

### Dependencies (4 packages to review):
1. `@astrojs/mdx` - Check if MDX content is actually used
2. `@types/jsonwebtoken` - May be needed for TypeScript types
3. `@types/ws` - May be needed for WebSocket TypeScript types  
4. `flexsearch` - Verify search functionality usage

### DevDependencies (44 packages to review):
1. `astro-eslint-parser` - Various astro plugins
2. `astro-expressive-code` - Code highlighting plugin
3. `astro-loader-github-prs` - GitHub PR loader
4. `astro-loader-github-releases` - GitHub releases loader
5. `astro-robots-txt` - Robots.txt generation
6. `astro-vitesse` - Astro theme/starter
7. `braces` - Glob pattern matching
8. `glob` - File globbing utility
9. `glob-parent` - Get parent directory from glob
10. `globby` - Enhanced glob matching
11. `micromatch` - Pattern matching utility
12. `picomatch` - Fast pattern matching
13. `hastscript` - Virtual DOM utilities
14. `html-entities` - HTML entity encoding
15. `js-base64` - Base64 encoding
16. `madge` - Dependency analysis
17. `mdast-util-directive` - Markdown directive utilities
18. `mdast-util-to-string` - Convert MDAST to string
19. `medium-zoom` - Image zoom functionality
20. `msw` - Mock Service Worker for testing
21. `oxc-parser` - JavaScript parser
22. `papaparse` - CSV parsing
23. `path-browserify` - Path utilities for browser
24. `postcss` - CSS processing
25. `postcss-import` - CSS import handling
26. `reading-time` - Calculate reading time
27. `rehype-autolink-headings` - Auto-link headings
28. `rehype-callouts` - Callout boxes in content
29. `rehype-external-links` - Handle external links
30. `rehype-katex` - Math rendering
31. `remark-code-import` - Import code in markdown
32. `remark-directive` - Directive support
33. `remark-imgattr` - Image attributes
34. `remark-math` - Math support in markdown
35. `remark-toc` - Table of contents generation
36. `resize-observer-polyfill` - ResizeObserver polyfill
37. `rollup-plugin-visualizer` - Bundle analysis
38. `satori` - SVG generation
39. `satori-html` - HTML to SVG conversion
40. `scheduler` - React scheduler
41. `shiki` - Syntax highlighting
42. `stream-browserify` - Stream polyfill for browser
43. `url-polyfill` - URL polyfill
44. `vfile` - Virtual file utilities

## 🎨 **CSS Framework Analysis**

### Current Situation:
- ✅ **UnoCSS**: Primary CSS framework (actively used)
- ❌ **TailwindCSS**: Redundant (to be removed)

### UnoCSS vs TailwindCSS Usage:
- **UnoCSS**: Configured in `astro.config.mjs`, used throughout components
- **TailwindCSS**: Appears to be legacy/unused based on codebase scan

## 📋 **Action Plan**

1. **Remove TailwindCSS**: Complete removal including config files
2. **Validate UnoCSS**: Ensure all functionality is working
3. **Clean up unused packages**: Remove after validation
4. **Update configurations**: Remove TailwindCSS references
