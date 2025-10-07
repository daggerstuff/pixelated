Type declarations (src/types)
=============================

Purpose
-------
This folder contains project-specific TypeScript declaration files. Keep them declaration-only.

Rules
-----
- Do NOT put runtime code (imports, function calls, extend(), etc.) in `.d.ts` files.
- Make `.d.ts` files module-scoped when possible by adding `export {}` at top-level to avoid duplicate global augmentation.
- Prefer minimal shims (only the symbols required) to avoid conflicts with `lib.dom` and third-party typings.
- If runtime behavior is required (e.g., calling `extend()` from three.js), implement it in a `.ts` runtime file and import it where needed.

If you need help migrating a runtime statement out of a `.d.ts` file, ask the team or create a task in the repo tracker.
