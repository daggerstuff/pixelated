KaTeX font assets are required here for proper math rendering. Place all KaTeX .woff2 and .woff files from node_modules/katex/dist/fonts/ into this directory if you need to serve them statically.

If you are seeing Vite warnings about missing KaTeX fonts, copy all files from:

node_modules/katex/dist/fonts/*

to:
public/fonts/

This ensures all KaTeX font assets are available at runtime for the KaTeX CSS to load them correctly.
