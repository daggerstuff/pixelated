## 2026-04-14 - Async Search Accessibility

Learning: Async search needs both visual spinners and invisible live regions for screen readers.
Action: Replaced text with spinner and added sr-only aria-live polite region.

## 2026-04-17 - MentalHealthChat Demo A11y

Learning: Interactive chat demo inputs and buttons often miss critical ARIA labels in prototype code.
Action: Always add explicit aria-labels and check for .trim() empty states on submission buttons even in demos.

## 2026-04-19 - Dynamic aria-labels in Admin Lists

Learning: Repeated icon and text buttons inside loops create ambiguous announcements for screen reader users.
Action: Use loop variables to provide specific, dynamically generated aria-labels.

## 2024-05-15 - Time Range Selectors

Learning: Custom time range buttons visually act as toggle buttons, but without aria-pressed state fails.
Action: Added `aria-pressed={true/false}` and grouped them with role="group".

## 2026-04-20 - Group roles and interactive button feedback

Learning: Elements with role="group" need an accessible name (aria-label).
Action: Added aria-label to role="group" and comprehensive styling to SessionControls buttons.
