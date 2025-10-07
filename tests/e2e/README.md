# End-to-End Tests for Critical User Journeys

This directory contains end-to-end tests that verify critical user journeys in the application using Playwright.

## Overview

End-to-end tests are designed to validate the complete flow of critical user journeys through the application, simulating real user behavior across multiple pages and interactions. These tests ensure that core functionality works correctly from the user's perspective.

## Test Structure

The tests are organized into the following files:

- **test-utils.ts**: Common utility functions for login, registration, and testing toast notifications
- **auth-journey.spec.ts**: Tests for the complete authentication flow (registration, login, password reset)
- **dashboard-journey.spec.ts**: Tests for dashboard functionality and navigation
- **user-experience.spec.ts**: Tests for UX features like page transitions and form interactions

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

The tests use a dedicated configuration file at `tests/e2e-config.ts`, which extends the base Playwright configuration with settings specific to end-to-end testing:

- Increased timeouts for complex flows
- Video recording for better debugging
- Focused browser selection for faster iteration
- Detailed HTML and JSON reports

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

The tests use mock data defined in utility functions. For authentication tests, predefined test accounts are used rather than creating new accounts for each test run, to avoid database pollution.

## Handling Flakiness

If tests become flaky, consider:

1. Adding explicit waits for dynamic content
2. Increasing timeouts for specific operations
3. Improving selectors to be more resilient
4. Adding retry logic for unstable operations

## Visual Testing

Some tests include visual comparison using Playwright's screenshot comparison capabilities. The baseline screenshots are stored in the repository and compared during test execution.

# MCP Integration with Playwright

This directory contains end-to-end tests that utilize the Model Context Protocol (MCP) server integration with Playwright.

## Setup and Configuration

The MCP integration is configured in `tests/mcp-e2e-config.ts`. This configuration:

- Connects to an MCP server running at `http://localhost:8033`
- Configures test reporters and output formats
- Sets up browsers and devices for testing
- Manages the web server for testing

## Running MCP Tests

To run the MCP-integrated tests:

```bash
# First, ensure you've connected to the MCP server through Cursor
# Then run tests with the MCP configuration
pnpm test:e2e:mcp
```

## Available Test Features

The MCP integration enables several advanced testing capabilities:

1. **Browser Tools Integration**: Access browser console logs, network requests, screenshots, and more through the MCP server
2. **Accessibility Testing**: Run automated accessibility audits on your pages
3. **Performance Testing**: Generate performance reports for your application
4. **SEO Auditing**: Check SEO best practices compliance
5. **Network Analysis**: Monitor and analyze network requests and responses

## Example Tests

See `mcp-example.spec.ts` for a basic example of how to integrate with the MCP server in your tests.

## Adding Your Own MCP Tests

When creating new MCP-integrated tests:

1. Create a new `.spec.ts` file in this directory
2. Import from `@playwright/test` as usual
3. Use the standard Playwright test API
4. Leverage MCP-specific features through annotations or API calls
5. Run using the MCP configuration

## Troubleshooting

If you encounter issues with the MCP integration:

1. Ensure the MCP server is running and accessible
2. Verify your connection to the MCP server through Cursor
3. Check that the configuration points to the correct MCP server URL
4. Review browser console logs for any connection errors
5. Make sure all required dependencies are installed

## Resources

- [MCP Documentation](https://example.com/mcp-docs)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Astro Testing Guide](https://docs.astro.build/en/guides/testing/)
