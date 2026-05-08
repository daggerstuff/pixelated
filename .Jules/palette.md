## 2026-04-14 - Async Search Accessibility | Learning: Async search needs both visual spinners (which do not shift layout like text does) and invisible live regions for screen readers. | Action: Replaced text with spinner and added sr-only aria-live polite region.

## 2026-04-17 - MentalHealthChat Demo A11y | Learning: Interactive chat demo inputs and buttons often miss critical ARIA labels and empty-state handling in prototype code. | Action: Always add explicit aria-labels and check for .trim() empty states on submission buttons even in prototype demos.

## 2026-04-19 - Dynamic aria-labels in Admin Lists | Learning: Repeated icon and text buttons inside loops create ambiguous announcements for screen reader users. | Action: Use loop variables to provide specific, dynamically generated aria-labels (e.g., `Edit ${item.name}`).

## 2024-05-15 - Time Range Selectors | Learning: Custom time range buttons visually act as toggle buttons, but without `aria-pressed`, screen reader users cannot perceive the active state. | Action: Added `aria-pressed={true/false}` and grouped them with `role="group"` and an explicit `aria-label`.
