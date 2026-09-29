// Single source of truth for vitest is the ROOT vitest.config.ts.
//
// This file previously duplicated it and the two drifted apart. The root
// config now carries the union of both (the lib/providers + lib/hooks jsdom
// targeted-routing pins, and the threat-detection/crisis node pinning). All
// changes go in the root config; this re-export keeps the documented
// `pnpm vitest run -c config/vitest.config.ts` invocation working.
export { default } from '../vitest.config.ts'
