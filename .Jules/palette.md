## 2026-04-14 - Async Search Accessibility | Learning: Async search needs both visual spinners (which do not shift layout like text does) and invisible live regions for screen readers. | Action: Replaced text with spinner and added sr-only aria-live polite region.

## 2026-04-17 - MentalHealthChat Demo A11y | Learning: Interactive chat demo inputs and buttons often miss critical ARIA labels and empty-state handling in prototype code. | Action: Always add explicit aria-labels and check for .trim() empty states on submission buttons even in prototype demos.

## 2026-04-19 - Dynamic aria-labels in Admin Lists | Learning: Repeated icon and text buttons inside loops create ambiguous announcements for screen reader users. | Action: Use loop variables to provide specific, dynamically generated aria-labels (e.g., `Edit ${item.name}`).

## 2026-04-20 - Selected State Accessibility in Analytics Charts | Learning: Time range selector buttons lacked ARIA indicators to announce their selected state, making it ambiguous for screen reader users to know which time range was active. | Action: Added `aria-pressed` to time range buttons to correctly convey selection state.
