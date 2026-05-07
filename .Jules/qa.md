## 2026-04-14 - QA: Added tests for createPrivacyHash edge case

- Pattern: Using `replace_with_git_merge_diff` to inject tests into pre-existing
  `describe` blocks where testing gaps exist.
- Action: Ensure edge cases like empty inputs are systematically tested.

## 2026-04-15 - access-control testing

- Pattern: Mocking internal dependencies to resolve Vite config import errors.
- Action: Use `vi.mock` with explicit relative path to replace module that has
  broken aliased imports.

## 2026-04-17 - Add comprehensive test suite for Express error-handler

- Pattern: When testing Express asyncHandler wrappers, the wrapped function
  executes asynchronously but the wrapper itself may return a non-promise or a
  promise that is not easily awaited in the test.
- Action: After invoking the wrapped handler, use
  `await new Promise((resolve) => process.nextTick(resolve))` to flush microtasks
  before asserting on the `next()` callback.

## 2026-04-18 - QA: Add test for template edge case

- Pattern: Mocking internal loggers and testing HTML string outputs.
- Action: Ensure edge cases like empty objects are systematically tested.

## 2026-04-19 - QA: Add test for isPartialBiasDashboardSummary

- Pattern: Untested utility functions like type guards are often missed in test
  coverage and should get dedicated targeted test files.
- Action: Create focused tests under `__tests__`, cover both positive and negative
  cases, and verify with localized execution `npx vitest run <file>`.

## 2026-04-26 - Fix localStorage tests in jsdom

- Pattern: In Vitest, spying on `window.localStorage` may fail to intercept
  direct `localStorage` calls.
- Action: Use `vi.spyOn(Storage.prototype, 'getItem')` to properly intercept
  these methods.

## 2026-04-27 - QA: Add test for analyzeTherapeuticTechniques edge case

- Pattern: Untested utility functions often lack `.test.ts` coverage and need
  isolated tests.
- Action: Add isolated tests that cover edge cases and verify with
  `node ./scripts/testing/local-test-runner.cjs`.

## 2026-04-28 - QA: Add test for getRecommendedScenario edge case

- Pattern: Untested branches in utility functions can leave behavior gaps.
- Action: Add targeted tests for edge branches in isolated test files and verify with
  `node ./scripts/testing/local-test-runner.cjs`.

## 2026-04-29 - QA: Fix privacy.test.ts jsdom environment

- Pattern: Tests touching browser globals like `window.localStorage` fail outside
  `jsdom`, and direct `localStorage` spying can miss direct calls.
- Action: Add `@vitest-environment jsdom` at the top of the test file and use
  `vi.spyOn(Storage.prototype, 'getItem')` to properly intercept direct calls.
