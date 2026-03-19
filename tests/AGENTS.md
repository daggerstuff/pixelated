# AGENTS.md: tests/

## PURPOSE

Full test suite: unit, integration, E2E, browser, performance, security, accessibility. Critical for HIPAA compliance and safety.

## STRUCTURE (TOP-LEVEL)

tests/
├── unit/          # Fast unit tests (Vitest, Pytest)
├── integration/   # API, DB, AI integration
├── e2e/           # End-to-end user flows (Playwright)
├── browser/       # Cross-browser (Chrome, Firefox, Safari)
├── performance/   # Load (k6), Lighthouse, memory
├── security/      # Penetration, compliance, vuln scans
├── accessibility/ # WCAG AA (axe-core, screen reader)
├── fixtures/      # Test data
├── mocks/         # Mock implementations
├── helpers/       # Utilities
└── conftest.py    # Pytest configuration

## STACK

- Frontend: Vitest, RTL, Playwright
- Backend: Pytest, httpx
- Perf: k6, Lighthouse CI
- Sec: OWASP ZAP, bandit

## CONVENTIONS

- **Files**: `*.test.ts` (unit), `*.spec.ts` (E2E), `test_*.py` (Python)
- **Placement**: Co-located or parallel `tests/` mirror
- **Data**: Synthetic only; never production PII
- **Mocks**: Mock external deps (HTTP, DB, AI)
- **Factories**: Use test data factories
- **Coverage targets**: unit 80%, integration 70%, critical 90%

## RUNNING

```bash
pnpm test                # Unit
uv run pytest           # Python
pnpm test:e2e           # E2E
pnpm test:coverage      # Coverage
./scripts/testing/security-tests.sh  # Security suite
```

Suites: `test:unit`, `test:integration`, `test:e2e:critical`, `test:accessibility`, `test:performance`.

## EXAMPLES

**Component test (Vitest)**:
```tsx
import { render, screen } from '@testing-library/react'
import Button from '@/components/Button'
test('renders', () => {
  render(<Button>Click</Button>)
  expect(screen.getByRole('button')).toHaveTextContent('Click')
})
```

**E2E (Playwright)**:
```typescript
import { test, expect } from '@playwright/test'
test('chat works', async ({ page }) => {
  await page.goto('/ai/chat')
  await page.fill('[data-testid="message-input"]', 'Hi')
  await page.click('[data-testid="send-button"]')
  await expect(page.locator('[data-testid="ai-message"]')).toBeVisible()
})
```

## SECURITY & COMPLIANCE

- HIPAA: PII redaction, FHE encryption validation
- Safety: Crisis detection, bias monitoring
- OWASP Top 10 coverage
- Audit trail verification

## PERFORMANCE BUDGETS

AI response <50ms, bundles <100KB, DB queries <10ms.

## DEBUGGING

```bash
pnpm test path/to/test.ts   # Single file
pnpm test --watch           # Watch mode
PLAYWRIGHT_DEBUG=1 pnpm test:e2e  # E2E trace
uv run pytest -vv ai/tests/test_bias.py
```

## ANTI-PATTERNS

❌ Flaky tests (random data, timing)
❌ External HTTP calls (always mock)
❌ Shared mutable state
❌ Skipping tests without justification
❌ Committing broken tests
❌ Testing implementation details

---

_Generated: 2025-03-15 | Domain: QA & Test Automation_
