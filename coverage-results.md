# Coverage Baseline Results

## Executive Summary

Baseline coverage measurement executed on 2026-03-21. Results show coverage infrastructure exists but thresholds are not configured, and many tests have import errors or are failing.

---

## Python Coverage Results

### Measurement Command
```bash
.venv/bin/python -m pytest tests/unit/safety/test_crisis_detector.py tests/nvidia/test_nim_validation.py --cov=tests/unit --cov=tests/nvidia --cov-report=term-missing -q
```

### Coverage Report
```
Name Stmts Miss Branch BrPart Cover Missing
---------------------------------------------------------------------------------------
tests/nvidia/test_nim_validation.py 163 111 28 1 28% 37-43, 51-61, ...
tests/unit/ai/test_dataset_pipeline.py 45 45 4 0 0% 5-90
tests/unit/safety/test_crisis_detector.py 22 14 0 0 36% 4, 10-12, ...
tests/unit/test_utilities.py 53 53 6 0 0% 5-98
---------------------------------------------------------------------------------------
TOTAL 283 223 38 1 19%
11 files skipped due to complete coverage.
```

**Python Coverage: 19%** (limited test run due to import errors)

### Test Results Summary
- 4 failed, 17 skipped (NVIDIA API key not set)
- Multiple collection errors due to missing `ai.core` module
- Tests that ran: 21 total

### Files Below Threshold (<70%)
| File | Coverage | Missing Lines |
|------|----------|---------------|
| tests/nvidia/test_nim_validation.py | 28% | 37-43, 51-61, 66-74, ... |
| tests/unit/safety/test_crisis_detector.py | 36% | 4, 10-12, 18-24, ... |
| tests/unit/ai/test_dataset_pipeline.py | 0% | 5-90 |
| tests/unit/test_utilities.py | 0% | 5-98 |

### Critical Paths Without Coverage
1. `src/lib/security/` - No Python tests found
2. `src/lib/fhe/` - No Python tests found
3. `src/lib/auth/` - No Python tests found
4. `ai/core/` - Module errors prevent testing

---

## TypeScript Coverage Results

### Measurement Command
```bash
NODE_ENV=test pnpm test:coverage
```

### Coverage Status
Coverage report **NOT GENERATED** due to test failures.

### Test Execution Summary
- Multiple test files with "describe is not defined" errors
- Many tests timing out (30s+ delays)
- Redis integration tests skipped (connection failed)
- Auth0 configuration incomplete warnings

### Test Failures Summary
| Test File | Status | Issues |
|-----------|--------|--------|
| src/lib/security/__tests__/phiDetection.test.ts | Failed | describe is not defined |
| src/lib/ai/bias-detection/__tests__/BiasDetectionEngine.test.ts | 1 failed | service overload |
| src/lib/auth/__tests__/integration.test.ts | 1 failed | middleware |
| src/components/admin/bias-detection/BiasDashboard.test.tsx | 39 failed | timeouts, rendering |
| src/lib/services/redis/__tests__/RedisService.integration.test.ts | 22 skipped | Redis not available |
| src/lib/ai/services/PatientResponseService.test.ts | 6 failed | prompt includes |

### Critical Paths Without Coverage
1. `src/lib/fhe/seal-service.ts` - Core encryption not tested
2. `src/lib/security/encryptionManager.ts` - Encryption utilities untested
3. `src/lib/auth/middleware.ts` - Auth middleware has 1 failing test
4. `src/lib/security/audit.logging.ts` - Audit trail not verified

---

## Configuration Gaps Identified

### Python (pyproject.toml)
```toml
# Missing:
[tool.coverage.report]
fail_under = 70  # NOT CONFIGURED
```

### TypeScript (vitest.config.ts)
```typescript
// Missing:
coverage: {
  thresholds: {
    lines: 70,
    functions: 70,
    branches: 70,
    statements: 70,
  },
}
```

---

## HIPAA Compliance Test Status

### Missing Infrastructure
- [ ] `scripts/consolidated-test.js` - Does not exist
- [ ] `tests/test_hipaa_compliance.py` - Does not exist
- [ ] `src/test/hipaa-compliance.test.ts` - Does not exist
- [ ] `package.json test:hipaa` - Script references missing file

### Required HIPAA++ Tests
1. Audit trail logging verification
2. Data encryption at rest (MongoDB FFE)
3. Access control enforcement
4. PHI data redaction in logs
5. Session timeout and auto-logout

---

## Security Test Status

### Existing Test Files
- [x] `src/lib/security/__tests__/phiDetection.test.ts` (broken)
- [x] `src/lib/security/__tests__/dlp.test.ts`
- [x] `src/lib/security/__tests__/token.encryption.test.ts`
- [x] `src/lib/security/__tests__/audit.logging.test.ts`
- [x] `src/lib/security/__tests__/security-scanning.test.ts`

### Missing Infrastructure
- [ ] `tests/test_security_scanning.py` - Does not exist
- [ ] `src/test/security.test.ts` - Does not exist
- [ ] `scripts/consolidated-test.js` - Does not exist

### Required Security Tests
1. Input validation (SQL injection, XSS)
2. Authentication bypass prevention
3. Secret management verification
4. Rate limiting enforcement
5. CORS configuration

---

## Summary Table

| Metric | Current | Required | Status |
|--------|---------|----------|--------|
| Python Coverage | 19% | 70% | FAIL |
| TypeScript Coverage | N/A | 70% | FAIL |
| HIPAA Tests | 0 | 5+ | MISSING |
| Security Tests (Python) | 0 | 5+ | MISSING |
| Security Tests (TS) | 5 (broken) | 5+ | PARTIAL |
| Coverage Thresholds | None | 70% | MISSING |

---

## Next Steps

1. **Create `scripts/consolidated-test.js`** - Test runner for hipaa/security/crypto
2. **Create HIPAA compliance test files** - Python and TypeScript
3. **Create security test files** - Python test suite
4. **Fix existing broken tests** - phiDetection.test.ts and others
5. **Add coverage thresholds** - Configure fail_under in both configs
6. **Run full coverage measurement** - After infrastructure is in place

---

## Critical Paths Requiring Immediate Coverage

| Path | Priority | Action Required |
|------|----------|-----------------|
| src/lib/fhe/ | CRITICAL | Add SEAL encryption tests |
| src/lib/security/ | CRITICAL | Fix phiDetection tests, add audit tests |
| src/lib/auth/ | CRITICAL | Fix middleware tests |
| tests/test_hipaa_compliance.py | CRITICAL | Create new file |
| tests/test_security_scanning.py | CRITICAL | Create new file |
