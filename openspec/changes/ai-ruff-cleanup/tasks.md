# Implementation Checklist: AI Ruff Cleanup

- [x] **Phase 1: Automated Fixes**
  - [x] 1.1 Run `uv run ruff check ai/ --fix` (safe fixes)
  - [x] 1.2 Verify remaining error count and categories
- [x] **Phase 2: Priority Rule Fixes**
  - [x] 2.1 Fix `DTZ005`: Replace `datetime.now()` with
        `datetime.now(timezone.utc)` (Completed)
  - [x] 2.2 Fix `UP035`/`UP006`: Migrate `typing.Dict/List` to built-ins
        (Completed)
  - [x] 2.3 Fix `Q000`: Normalize quote usage (Completed)
  - [x] 2.4 Fix `PT009`: Migrate `unittest` assertions to `pytest` (Completed
        simple instances, ~1,000 multiline remaining)
- [x] **Phase 3: Cleanup & Refactoring**
  - [x] 3.1 Remove unused imports (`F401`) and variables (`F841`) (Completed)
  - [x] 3.2 Address bare excepts (`E722`) and subprocess issues (`PLW1510`)
        (Completed)
  - [x] 3.3 Exception chaining (`B904`) (Completed safe ones)
  - [x] 3.4 Unused arguments (`ARG001`, `ARG002`) (Completed)
  - [x] 3.5 Local imports (`PLC0415`) (Migrated ~170 files safely)
  - [x] 3.6 Final Ruff pass and formatting (`ruff format ai/`)
- [x] **Phase 4: Validation**
  - [x] 4.1 Run full ruff check on `ai/` (Total errors reduced from ~34k to
        ~9.5k total, including ~6.7k prints)
  - [x] 4.2 Fix baseline syntax errors in test files (Resolved all
        "invalid-syntax" errors)
  - [x] 4.3 Commit changes frequently to submodule and parent repository
        (Completed)
