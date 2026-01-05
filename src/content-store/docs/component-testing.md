---
title: "Component Testing Guide"
description: "Component Testing Guide documentation"
pubDate: 2024-01-15
author: "Pixelated Team"
tags: ["documentation", "testing", "components"]
draft: false
toc: true
---

# Component Testing Guide

This guide outlines how to test components in our hybrid Astro/React architecture.

## Table of Contents

- [Overview](#overview)
- [Testing React Components](#testing-react-components)
- [Testing Astro Components](#testing-astro-components)
- [Testing Converted Components](#testing-converted-components)
- [Best Practices](#best-practices)

## Overview

Our testing strategy handles both React components and Astro components:

- **React components**: Tested using Vitest and @testing-library/react
- **Astro components**: Tested using a combination of unit tests for React parts and integration tests with Playwright

## Testing React Components

For standard React components, we follow traditional React testing patterns:

```tsx
// Example: Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
;
import Button from '../Button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

## Testing Astro Components

Astro components require a different approach since they're primarily server-rendered:

### Unit Testing React Parts

If your Astro component wraps a React component with client-side hydration:

1. Test the underlying React component directly
2. Use integration tests for the full Astro component

### Integration Tests with Playwright

For full Astro component testing:

```ts
// Example: Button.spec.ts (Playwright)
import { test, expect } from '@playwright/test';

test('Button component renders correctly', async ({ page }) => {
  // Navigate to the test page that includes the component
  await page.goto('/test-components/button');

  // Check that the button is rendered
  const button = page.locator('button.btn');
  await expect(button).toBeVisible();

  // Test interactions
  await button.click();
  await expect(page.locator('.result')).toHaveText('Button clicked');
});
```

## Testing Converted Components

When testing components that have been converted from React to Astro using our wrapper pattern:

### 1. Update Test Imports

Update your test imports to point to the React version of the component:

```tsx
// Before conversion
import SearchDemo from '../SearchDemo';

// After conversion
import SearchDemoReact from '../SearchDemoReact';
```

### 2. Update Component References

Make sure to update component references in your tests:

```tsx
// Before
render(<SearchDemo />);

// After
render(<SearchDemoReact />);
```

### 3. Add Integration Tests for Astro Wrappers

```ts
// Example: SearchDemo.spec.ts (Playwright)
import { test, expect } from '@playwright/test';

test('SearchDemo renders correctly with Astro wrapper', async ({ page }) => {
  await page.goto('/test-components/search-demo');

  // Check that the wrapper adds the expected structure
  await expect(page.locator('.search-demo-wrapper')).toBeVisible();

  // Check that the React component hydrates correctly
  await page.fill('input[placeholder="Search..."]', 'test query');
  await page.click('button[type="submit"]');

  // Check for expected results after hydration
  await expect(page.locator('.search-results')).toContainText('Results for: test query');
});
```

## Best Practices

### Testing Strategy

1. **Unit test React components** for logic, rendering, and interactions
2. **Integration test Astro components** for full rendering, hydration, and end-user interactions
3. **Mock API calls and services** to focus on component behavior

### Test Location

- Place tests for React components in `__tests__` directory next to the component
- Place Playwright integration tests in `tests/integration`

### Test Coverage

Aim for:

- High coverage of React component logic
- Focused integration tests for Astro components
- Complete coverage of critical user flows

### Handling Astro-Specific Features

When testing components that use Astro-specific features:

#### Slots

For components that use Astro's slot system, test the underlying React components with children props:

```tsx
// Testing a component that would have slots in its Astro version
render(
  <CardReact>
    <h2>Card Title</h2>
    <p>Card content</p>
  </CardReact>
);
```

#### Client Directives

When testing React components that would be hydrated with client directives in Astro:

1. Test the React component directly
2. Use Playwright to test the hydration behavior in integration tests

### Example: Testing Converted Analytics Dashboard

```tsx
// AnalyticsDashboard.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AnalyticsDashboardReact from '../AnalyticsDashboardReact';

// Mock dependencies
vi.mock('@/lib/analytics', () => ({
  fetchAnalyticsData: vi.fn().mockResolvedValue({
    metrics: [...],
    charts: [...],
  }),
}));

describe('AnalyticsDashboardReact', () => {
  const defaultProps = {
    messages: [],
    securityLevel: 'high',
    encryptionEnabled: true,
    scenario: 'test',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    render(<AnalyticsDashboardReact {...defaultProps} />);
    expect(screen.getByText('Loading analytics...')).toBeInTheDocument();
  });

  it('renders analytics content after loading', async () => {
    render(<AnalyticsDashboardReact {...defaultProps} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading analytics...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    // More assertions for the loaded content
  });
});
```

## Troubleshooting

### Common Testing Issues

1. **Component not hydrating in tests**: When testing React components that are wrapped by Astro, make sure you're testing the React component directly.

2. **Props mismatch**: If a component was converted and props were changed, ensure test data is updated accordingly.

3. **Styles missing in tests**: Remember that Astro's scoped styles won't be applied in React component tests. Focus on functionality over styling in unit tests.

4. **Hydration errors in integration tests**: Check that your Astro component is using the correct client directive for the React component it wraps.

For more help with testing, consult the Vitest and Playwright documentation or reach out to the development team.
