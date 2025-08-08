# Lint Tasks

A checklist to track lint and type errors fixes.

## 1. Errors (High Priority)
- [ ] Remove duplicate imports/redeclarations in `src/pages/api/ai/intervention-analysis.ts`
- [ ] Fix empty-interface errors in `src/test/vitest.d.ts`
- [ ] Handle or rename unused catch parameters (e.g., in `src/buffer-polyfill.js`)

## 2. TypeScript Strictness
- [ ] Replace `: any` and `Function` types with precise types or `unknown` globally
- [ ] Define proper types for filters and query results in `src/services/mongodb.dao.ts`, `pages/api/ai/performance-metrics.ts`, `pages/api/todos.ts`
- [ ] Specify state types in React components/hooks instead of `any` (e.g., `useState<any>`)

## 3. Remove Unused Variables & Parameters
- [ ] Remove or prefix unused parameters/variables in `src/services/auth.service.ts` and `src/services/mongoAuth.service.ts`
- [ ] Remove or rename variables declared but never used (e.g., `user` → `_user`)

## 4. React/JSX & Accessibility
- [ ] Replace `key={index}` with stable unique keys in lists
- [ ] Add `tabIndex` and keyboard handlers (e.g., `onKeyDown`) to clickable elements
- [ ] Associate `<label>` elements with controls via `htmlFor` or wrapping

## 5. Legacy JS & Block Scoping
- [ ] Refactor loops in `src/components/admin/backup/BackupLocationTab.js` to use `let`/`const`
- [ ] Replace `new ChatDemoInterface()` side-effects in `src/pages/demo/chat.astro` with an explicit init call

## 6. Scheduler-Tracing Type Definitions
- [ ] Replace `Function` types in `src/@types/scheduler-tracing.d.ts` with typed callback signatures

## 7. Health Check & Unused Interfaces
- [ ] Remove unused interfaces and parameters (e.g., `RedisHealth`, `request`) in `src/pages/api/v1/health.ts`
- [ ] Remove unused variables such as `offset` in `src/pages/api/v1/admin/users.ts`

## 8. Testing Typings Improvements
- [ ] Remove `as any` and replace with proper types in `src/test/setup.ts`
- [ ] Define explicit types in demo components instead of `any`
