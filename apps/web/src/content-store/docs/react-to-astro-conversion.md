---
title: React to Astro Conversion Guide
description: Practical notes for migrating React components to Astro components.
pubDate: '2026-05-09'
---

# React to Astro Conversion Guide

Use this checklist when converting a React component into an Astro-friendly
implementation.

## 1) Classify component behavior

Before editing code, classify each component as:

- **Static render only**: can be server rendered entirely.
- **Interactive**: needs JavaScript in the browser.
- **Client-only**: relies on browser-only APIs or third-party UI libraries that
  must not run during SSR.

Prefer server-rendered output whenever possible to keep hydration budgets low.

## 2) Confirm destination location

Use the following target layout pattern when migrating:

- Keep static UI building blocks in `.astro` files.
- Keep behavior-heavy widgets in React islands.
- Preserve folder grouping from the source component library so imports stay
  discoverable.

Example structure used in docs-driven migrations:

- `src/components/<category>/<Component>.astro`
- `src/components/<category>/<Component>.jsx` (or `.tsx`) for React islands

If you are migrating a component that already has tests, keep tests near the
destination component. Use the same test path convention as existing files so
traceability is preserved.

## 2) Start by stripping React-specific logic

Identify and remove assumptions that are specific to React internals:

- `useState`, `useEffect`, `useMemo`, `useCallback`
- Custom hooks that only use browser APIs for initialization
- `children` patterns where static markup can be passed as Astro slots/props

If state/effect is still required, plan to keep the component as a **React
island** and use an Astro directive for hydration.

## 3) Convert file structure

### From React

```tsx
import React, { useState } from 'react'

export interface CardProps {
  title: string
  isActive?: boolean
}

export function Card({ title, isActive = false }: CardProps) {
  const [expanded, setExpanded] = useState(false)
  return (
    <article className={isActive ? 'active' : ''}>
      <h2>{title}</h2>
      <button onClick={() => setExpanded((value) => !value)}>
        {expanded ? 'Hide' : 'Show'}
      </button>
    </article>
  )
}
```

### To Astro

```astro
---
interface Props {
  title: string;
  isActive?: boolean;
}

const { title, isActive = false } = Astro.props as Props;
---

<article class:list={['card', isActive && 'active']}>
  <h2>{title}</h2>
</article>
```

If interactivity is required, keep the original React component and render it as
a **React island** instead.

### Keep API boundaries stable

When migrating, preserve prop names and event callback contracts as much as
possible.

- Same prop casing (`title`, `isActive`, `onX` handlers).
- Minimal shape changes; prefer adapters at call sites when names must differ.
- Document any behavior differences explicitly in the component’s usage notes.

## 4) Migration strategy for interactive components

Keep a React component when:

- event handlers are complex,
- state transitions are central to behavior,
- or third-party dependency requires React runtime.

Then use the smallest hydration option:

- `client:load` for always-on UI controls.
- `client:visible` for foldable/scroll-into-view interactions.
- `client:idle` for non-urgent background actions.
- `client:only="react"` only if server rendering is not possible.

Example:

```astro
---
import MessageForm from '../components/MessageForm.jsx';
---
<MessageForm client:visible />
```

### Hydration directive guidance

Choose the lightest directive that still meets UX requirements:

| Use case                                   | Recommended directive |
| ------------------------------------------ | --------------------- |
| Above-the-fold, critical interaction       | `client:load`         |
| Scroll-driven or section-based interaction | `client:visible`      |
| Optional, low-priority behavior            | `client:idle`         |
| Needs CSS/media-query-only boot conditions | `client:media`        |
| React-dependent rendering only             | `client:only`         |

If an interactive component depends on router state or context, prefer a single
isolated island over global hydration of the parent page.

## 5) Data loading and props

Move fetch/IO logic into an Astro `load` context or page-level script whenever
possible.

- Keep API calls out of component render logic.
- Pass only primitive props or serializable objects into React islands.
- Keep sensitive keys out of client bundles.

## 6) Styling and assets

- Prefer component-scoped `<style>` in `.astro` for static components.
- Keep design-system classes centralized and reuse existing utility patterns.
- Migrate React CSS imports by validating build tool support for each asset
  type.

When migrating style dependencies, verify:

- CSS module names still resolve after file extension changes.
- Shared theme tokens continue to come from the existing source of truth.
- Accessibility states remain present (`:focus-visible`, `aria-*`) in static and
  interactive versions.

## 7) Verification checklist

1. Confirm the target markdown and import links still resolve.
2. Run through desktop + mobile rendering for static and interactive variants.
3. Verify hydration behavior aligns with user expectations.
4. Add or update tests for interaction and snapshots.
5. Update usage examples in the destination docs.

This process aligns with the [Component Testing Guide](./component-testing.md)
and the conventions in the [Component Library](./component-library.md).

## 8) Common migration risks

- Over-hydrating a whole page when only one child requires browser code.
- Introducing client-only props into a server-rendered parent component.
- Forgetting to remove React event wiring in a pure `.astro` conversion.
- Leaving stale imports to React runtime files no longer used.

## 9) Exit criteria

- [ ] Static version renders identically to the React source.
- [ ] Hydration mode is explicit and intentionally chosen.
- [ ] Tests cover both server-rendered and client-hydrated behavior.
- [ ] Documentation and examples are updated where behavior changed.
