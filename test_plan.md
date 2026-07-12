# Plan

1. **Create tests for utility functions**: Create a new file
   `src/types/__tests__/utility.test.ts` to test the `Result`, `Success`,
   `Failure` types, and `isSuccess`, `isFailure` type guards defined in
   `src/types/utility.ts`.
2. **Test `isSuccess`**: Create test cases that verify `isSuccess` returns
   `true` when `success` is `true` and returns `false` when `success` is
   `false`.
3. **Test `isFailure`**: Create test cases that verify `isFailure` returns
   `true` when `success` is `false` and returns `false` when `success` is
   `true`.
4. **Run tests**: Run
   `NODE_ENV=test npx vitest run src/types/__tests__/utility.test.ts` to
   ensure the new tests pass.
5. **Run full suite**: Run the full test suite with `pnpm run test` (or using
   `NODE_ENV=test npx vitest run`) to ensure no regressions occur.
6. **Pre-commit steps**: Complete pre-commit steps to ensure proper testing,
   verification, review, and reflection are done.
7. **Submit PR**: Create a PR with title starting with "🧪 QA: ".
