---
title: "Code Splitting Best Practices"
description: "Code Splitting Best Practices documentation"
pubDate: 2024-01-15
author: "Pixelated Team"
tags: ["documentation"]
draft: false
toc: true
---

# Code Splitting Best Practices

This guide outlines our approach to code splitting in the project, which helps reduce initial load times and improves performance by loading code only when needed.

## Table of Contents

- [Introduction](#introduction)
- [When to Use Code Splitting](#when-to-use-code-splitting)
- [Implementation Techniques](#implementation-techniques)
  - [React Component Lazy Loading](#react-component-lazy-loading)
  - [Astro Dynamic Imports](#astro-dynamic-imports)
  - [Manual Dynamic Imports](#manual-dynamic-imports)
- [Performance Considerations](#performance-considerations)
- [Testing Split Components](#testing-split-components)
- [Examples from Our Codebase](#examples-from-our-codebase)

## Introduction

Code splitting is a technique that breaks down our application code into smaller chunks that can be loaded on demand or in parallel. This improves:

- **Initial Load Time**: Users download only the code necessary for the current view
- **Resource Usage**: Reduces memory usage by loading components only when needed
- **Perceived Performance**: Main thread is less blocked during initial render

## When to Use Code Splitting

Code splitting is most effective for:

- **Large Components**: Components over 20KB in size
- **Conditionally Rendered Components**: UI that isn't immediately visible (tabs, modals, etc.)
- **Route-Based Splitting**: Different pages/routes
- **Feature-Based Splitting**: Optional features that aren't needed by all users

### Good Candidates in Our Project

1. **Analytics Dashboards**: Large, data-visualization-heavy components
2. **Media Processing Components**: Components that handle image/video processing
3. **Complex Form Systems**: Multi-step forms, specialized inputs
4. **Rich Text Editors**: WYSIWYG editors and formatting tools
5. **Interactive Chat Interfaces**: Real-time messaging and complex UI

## Implementation Techniques

### React Component Lazy Loading

For React components, use React's built-in `lazy` and `Suspense` APIs:

```tsx
import { lazy, Suspense } from 'react'

// Instead of: import LargeComponent from './LargeComponent'
const LargeComponent = lazy(() => import('./LargeComponent'))

function MyComponent() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <LargeComponent />
    </Suspense>
  )
}
```

### Astro Dynamic Imports

For Astro components with client interactive components, use both `client:only` and dynamic imports:

```astro
---
// Instead of:
// import HeavyComponent from '../components/HeavyComponent'
---

<div id="component-container">
  <!-- Loading state renders immediately -->
  <div id="loading-placeholder" class="animate-pulse">
    <div class="h-40 bg-gray-200 dark:bg-gray-800 rounded"></div>
  </div>
</div>

<script>
  // Client-side dynamic import
  document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('component-container');
    const placeholder = document.getElementById('loading-placeholder');

    try {
      const { default: HeavyComponent } = await import('../components/HeavyComponent');

      // Replace placeholder with component
      if (placeholder) placeholder.style.display = 'none';
      // Render with client hydration framework (React in this example)
      // Implementation depends on the component framework
    } catch (error) {
      console.error('Failed to load component:', error);
    }
  });
</script>
```

Alternatively, for simpler cases, use Astro's client directives with partial hydration:

```astro
---
import HeavyComponent from '../components/HeavyComponent.jsx'
---

<HeavyComponent client:visible />
```

### Manual Dynamic Imports

For utility functions and non-UI code:

```javascript
// Instead of: import { complexFunction } from './utils'

async function handleAction() {
  // Only import when needed
  const { complexFunction } = await import('./utils')
  const result = complexFunction()
  // ...
}
```

## Performance Considerations

1. **Loading States**: Always provide meaningful loading states while chunks load
2. **Prefetching**: Consider prefetching important chunks before they're needed
   ```js
   // Prefetch a component when hovering over a button that will show it
   const prefetchComponent = () => import('./LargeComponent')
   ```
3. **Chunk Size Monitoring**: Track chunk sizes in build output to identify optimization opportunities
4. **Bundle Analysis**: Periodically run bundle analysis tools to identify bloated dependencies

## Testing Split Components

When testing code-split components:

1. Test the component in isolation as you would any component
2. Test the loading state appearance and behavior
3. Test the component integration, including the dynamic loading process
4. Test error handling for load failures

Add the following to your Vitest tests:

```js
import { lazy, Suspense } from 'react'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

// Mock the lazy-loaded component
vi.mock('./HeavyComponent', () => ({
  default: () => <div data-testid="heavy-component">Heavy Component Content</div>
}))

const HeavyComponent = lazy(() => import('./HeavyComponent'))

test('renders lazy component with loading state', async () => {
  render(
    <Suspense fallback={<div data-testid="loading">Loading...</div>}>
      <HeavyComponent />
    </Suspense>
  )

  // Should show loading state first
  expect(screen.getByTestId('loading')).toBeInTheDocument()

  // Wait for component to load
  await screen.findByTestId('heavy-component')
  expect(screen.getByTestId('heavy-component')).toBeInTheDocument()
})
```

## Examples from Our Codebase

### AnalyticsDashboardReact

We lazy load the analytics dashboard since it's data-visualization heavy and not needed immediately:

```tsx
// Before:
// import AnalyticsDashboardReact from './AnalyticsDashboardReact'

// After:
import { lazy, Suspense } from 'react'
const AnalyticsDashboardReact = lazy(() => import('./AnalyticsDashboardReact'))

// Usage
{showAnalytics && (
  <Suspense fallback={<LoadingAnalytics />}>
    <AnalyticsDashboardReact
      messages={messages}
      securityLevel={securityLevel}
      encryptionEnabled={encryptionEnabled}
      scenario={scenarioName}
    />
  </Suspense>
)}
```

### MentalHealthChatDemo

For the mental health chat demo, we use Astro's dynamic imports with client:only:

```astro
---
// Instead of direct import
// import MentalHealthChatDemoReact from './MentalHealthChatDemoReact'
---

<div id="loading-placeholder" class="animate-pulse">
  <div class="w-full h-[600px] bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
</div>

<div id="chat-component" class="hidden">
  <MentalHealthChatDemoReact client:only="react" />
</div>

<script>
  document.addEventListener('DOMContentLoaded', async () => {
    const { default: MentalHealthChatDemoReact } = await import('./MentalHealthChatDemoReact');
    // Render component and hide placeholder
  });
</script>
```

## Best Practices Summary

1. **Be Selective**: Only split components that provide meaningful performance benefits
2. **Provide Good Loading States**: Always show meaningful loading UI during fetch
3. **Error Handling**: Handle loading failures gracefully
4. **Measure Impact**: Verify performance improvements with tools like Lighthouse
5. **Consistent Approach**: Follow the established patterns in this guide
6. **Document Split Points**: Add comments explaining why a component is code-split

By following these guidelines, we can maintain a fast, efficient application while keeping our codebase maintainable.