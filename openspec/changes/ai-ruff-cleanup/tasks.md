# Implementation Checklist: AI Ruff Cleanup

- [x] **Phase 1: Automated Fixes**
    - [x] 1.1 Run `uv run ruff check ai/ --fix` (safe fixes)
    - [x] 1.2 Verify remaining error count and categories
- [ ] **Phase 2: Priority Rule Fixes**
    - [x] 2.1 Fix `DTZ005`: Replace `datetime.now()` with `datetime.now(timezone.utc)` (Completed across entire package)
    - [x] 2.2 Fix `UP035`/`UP006`: Migrate `typing.Dict/List` to built-ins (Completed)
    - [x] 2.3 Fix `Q000`: Normalize quote usage (Completed)
    - [x] 2.4 Fix `PT009`: Migrate `unittest` assertions to `pytest` (Completed >2,000 instances)
- [ ] **Phase 3: Cleanup & Refactoring**
    - [x] 3.1 Remove unused imports (`F401`) and variables (`F841`) (Largely completed)
    - [ ] 3.2 Address bare excepts (`E722`) and subprocess issues (`PLW1510`)
    - [ ] 3.3 Final Ruff pass and formatting (`ruff format ai/`)
- [ ] **Phase 4: Validation**
    - [x] 4.1 Run full ruff check on `ai/` (Verified reduction from ~34k to ~10k total)
    - [ ] 4.2 Run existing tests in `ai/` if available
