## 2025-05-15 - [Astro Event Listener Lifecycle]

**Learning:** In Astro with View Transitions, global event listeners attached to `document` or `window` persist across navigations. Adding them in `astro:page-load` without cleanup leads to accumulation of duplicate listeners.
**Action:** Always use `astro:before-preparation` (or `astro:before-swap`) to remove global event listeners and reset global states (like `body.style.overflow`) before the next page loads.
