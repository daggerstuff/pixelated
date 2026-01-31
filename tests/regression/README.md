# Regression Test Coverage

This directory contains regression tests to ensure that previously fixed bugs do not reoccur.

## Structure

- `regression-suite.spec.ts` - Main regression test suite
- `regression.config.json` - Configuration for regression testing
- `utils/RegressionUtils.ts` - Utility functions for regression testing

## Test Categories

### Authentication Regressions
- Expired token handling
- Concurrent login race conditions

### Chat Functionality Regressions  
- Message history persistence
- Special character handling
- Duplicate message prevention

### UI/UX Regressions
- Mobile responsive layout
- Keyboard navigation
- Accessibility compliance

### Performance Regressions
- Dashboard loading times
- Memory usage with large datasets
- Network timeout handling

### Data Integrity Regressions
- User preference persistence
- Network interruption handling
- Data validation

### Security Regressions
- XSS attack prevention
- File upload validation
- Input sanitization

## Running Regression Tests

```bash
# Run all regression tests
pnpm dlx playwright test tests/regression

# Run specific category
pnpm dlx playwright test tests/regression --grep "Authentication"

# Run with performance monitoring
pnpm dlx playwright test tests/regression --reporter=html
```

## Bug Tracking

Each test is linked to a specific bug ID that was previously fixed:
- AUTH-001: Expired tokens were accepted
- CHAT-001: Message history lost on refresh
- UI-001: Mobile layout breakage
- PERF-001: Slow dashboard loading
- SEC-001: XSS vulnerability
- And more...

## Adding New Regression Tests

When fixing a bug:
1. Add a regression test to prevent reoccurrence
2. Update the bug tracking list in `regression.config.json`
3. Document the test in this README
4. Ensure the test fails before the fix and passes after

## Performance Monitoring

Regression tests include performance monitoring to catch performance regressions:
- Page load times
- Memory usage
- Network request timing
- JavaScript execution time

## Security Validation

Security regression tests validate:
- XSS protection
- CSRF protection  
- Input sanitization
- File upload security
- Authentication security
