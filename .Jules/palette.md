## 2025-05-15 - [Icon-only Button Accessibility]
**Learning:** Icon-only buttons (using `size="icon"` variant of the `Button` component) across the codebase frequently lack `aria-label` and `title` attributes, making them inaccessible to screen readers and providing no visual hint on hover.
**Action:** Always ensure `aria-label` and `title` (or a Tooltip wrapper) are provided when using icon-only buttons. Check for this pattern when reviewing or modifying UI components.
