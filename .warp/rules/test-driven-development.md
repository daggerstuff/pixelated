# Test-Driven Development (TDD)

**When to apply:** Use when implementing any feature or bugfix, before writing implementation code.

## Core Principle

Write the test first. Watch it fail. Write minimal code to pass.

**CRITICAL:** If you didn't watch the test fail, you don't know if it tests the right thing.

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Write code before the test? Delete it. Start over.

## Red-Green-Refactor Cycle

### RED - Write Failing Test

Write one minimal test showing what should happen.

**Requirements:**
- One behavior per test
- Clear, descriptive name
- Real code (no mocks unless unavoidable)

**Good example:**
```typescript
test('retries failed operations 3 times', async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    if (attempts < 3) throw new Error('fail');
    return 'success';
  };
  
  const result = await retryOperation(operation);
  
  expect(result).toBe('success');
  expect(attempts).toBe(3);
});
```

### Verify RED - Watch It Fail

**MANDATORY. Never skip.**

```bash
pnpm test path/to/test.test.ts  # Node.js
uv run pytest tests/            # Python
```

Confirm:
- Test fails (not errors)
- Failure message is expected
- Fails because feature missing (not typos)

**Test passes?** You're testing existing behavior. Fix test.

### GREEN - Minimal Code

Write simplest code to pass the test. Don't add features, refactor other code, or "improve" beyond the test.

### Verify GREEN - Watch It Pass

**MANDATORY.**

```bash
pnpm test path/to/test.test.ts
```

Confirm:
- Test passes
- Other tests still pass
- Output pristine (no errors, warnings)

### REFACTOR - Clean Up

After green only:
- Remove duplication
- Improve names
- Extract helpers

Keep tests green. Don't add behavior.

## Red Flags - STOP and Start Over

- Code before test
- Test after implementation
- Test passes immediately
- Can't explain why test failed
- "I'll write tests after to verify it works"
- "I already manually tested it"
- "Just this once"
- "Keep as reference" or "adapt existing code"

**All of these mean: Delete code. Start over with TDD.**

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
| "Already manually tested" | Ad-hoc ≠ systematic. No record, can't re-run. |
| "Deleting X hours is wasteful" | Sunk cost fallacy. Keeping unverified code is technical debt. |
| "TDD will slow me down" | TDD faster than debugging. Pragmatic = test-first. |

## Before Completing Work

Verify:
- [ ] Every new function/method has a test
- [ ] Watched each test fail before implementing
- [ ] Each test failed for expected reason (feature missing, not typo)
- [ ] Wrote minimal code to pass each test
- [ ] All tests pass
- [ ] Output pristine (no errors, warnings)
- [ ] Edge cases and errors covered

Can't check all boxes? You skipped TDD. Start over.

---

*Adapted from Cursor skill for Warp Agent Mode*
