## 2026-04-14 Async Search
Async search needs both visual spinners and invisible live regions for screen readers
Action: Replaced text with spinner and added sr-only aria-live polite region

## 2026-04-17 MentalHealthChat Demo A11y
Interactive chat demo inputs and buttons often miss critical ARIA labels in prototype code
Action: Always add explicit aria-labels and check for .trim() empty states on submission buttons even in demos

## 2026-04-19 Dynamic aria-labels
Repeated icon and text buttons inside loops create ambiguous announcements for screen reader users
Action: Use loop variables to provide specific dynamically generated aria-labels

## 2024-05-15 Time Range Selectors
Custom time range buttons visually act as toggle buttons but without aria-pressed state
Action: Added `aria-pressed={true/false}` and grouped them with role="group"

## 2026-04-20 Group roles and buttons
Elements with role="group" need an accessible name
Action: Added aria-label to role="group" and comprehensive styling to SessionControls buttons