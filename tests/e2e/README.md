# End-to-End Tests for Critical User Journeys

This directory contains end-to-end tests that verify critical user journeys in
the application using Playwright.

## Overview

End-to-end tests are designed to validate the complete flow of critical user
journeys through the application, simulating real user behavior across multiple
pages and interactions. These tests ensure that core functionality works
correctly from the user's perspective.

## Test Structure

The tests are organized into the following files:

- **test-utils.ts**: Common utility functions for login, registration, and
  testing toast notifications
- **auth-journey.spec.ts**: Tests for the complete authentication flow
  (registration, login, password reset)
- **dashboard-journey.spec.ts**: Tests for dashboard functionality and
  navigation
- **user-experience.spec.ts**: Tests for UX features like page transitions and
  form interactions

## Running the Tests

To run the end-to-end tests:

```bash
# Run all E2E tests
pnpm test:e2e

# Run with UI for debugging
pnpm test:e2e:ui

# Run in debug mode
pnpm test:e2e:debug

# View the HTML report after running tests
pnpm test:e2e:report
```

## Configuration

E2E tests use the shared Playwright configuration at `config/playwright.config.ts`
(`testDir: tests/`). Use the `pnpm test:e2e*` scripts above rather than ad-hoc
config files under `tests/`.

## Test Coverage

These tests cover the following critical user journeys:

### Authentication Journey

- Registration of new users
- Login with correct and incorrect credentials
- Password reset flow
- "Remember me" functionality
- CSRF protection

### Dashboard Journey

- Dashboard access and component loading
- Sidebar navigation between sections
- Data visualization interaction
- Profile management and editing
- Mobile responsiveness

### User Experience

- Page transitions between routes
- Toast notifications for user feedback
- Loading states during async operations
- Form interaction feedback

## Adding New Tests

When adding new tests:

1. Consider whether the test represents a critical user journey
2. Reuse utility functions from `test-utils.ts` where possible
3. Structure tests to be independent and repeatable
4. Include mobile viewport testing for critical flows
5. Verify both happy path and error cases

## Test Data

The tests use mock data defined in utility functions. For authentication tests,
predefined test accounts are used rather than creating new accounts for each
test run, to avoid database pollution.

## Handling Flakiness

If tests become flaky, consider:

1. Adding explicit waits for dynamic content
2. Increasing timeouts for specific operations
3. Improving selectors to be more resilient
4. Adding retry logic for unstable operations

## Visual Testing

Some tests include visual comparison using Playwright's screenshot comparison
capabilities. The baseline screenshots are stored in the repository and compared
during test execution.
