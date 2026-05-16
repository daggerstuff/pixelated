## 2026-04-14 - Async Search Accessibility

- Learning: Async search needs both visual spinners that do not shift layout
  like text does, and invisible live regions for screen readers.
- Action: Replaced text with a spinner and added an `sr-only`
  `aria-live="polite"` region.

## 2026-04-17 - MentalHealthChat Demo A11y

- Learning: Interactive chat demo inputs and buttons often miss critical ARIA
  labels and empty-state handling in prototype code.
- Action: Always add explicit `aria-labels` and check for `.trim()` empty states
  on submission buttons even in prototype demos.

## 2026-04-19 - Dynamic aria-labels in Admin Lists

- Learning: Repeated icon and text buttons inside loops create ambiguous
  announcements for screen reader users.
- Action: Use loop variables to provide specific, dynamically generated
  aria-labels (for example, `Edit ${item.name}`).

## 2024-05-15 - Time Range Selectors

- Learning: Custom time range buttons visually act as toggle buttons, but
  without `aria-pressed`, screen reader users cannot perceive the active state.
- Action: Added `aria-pressed={true/false}` and grouped them with `role="group"`
  and an explicit `aria-label`.

## 2026-05-16 - Analytics Dashboard Accessibility

- Learning: Custom chart bars and progress bars made with `div` elements are invisible to screen readers and keyboard users without explicit ARIA roles, labels, and `tabIndex`.
- Action: Added `role="img"`, `tabIndex={-1}`, and `aria-label` to chart bars. Added `role="progressbar"` and related ARIA attributes to custom progress elements, and ensured visual icons have screen-reader fallbacks.
