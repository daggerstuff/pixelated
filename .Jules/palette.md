## 2026-06-18 - Search Modal Accessibility

**Learning:** Search overlays often lack proper dialog ARIA roles, making them
invisible to screen readers.

**Action:** Added `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` to
the search modal in `HeaderReact.tsx`. Added `autoFocus={true}` to `SearchBox`
to trap focus on open.
## 2026-06-18 - Filter Button Accessibility Fix

**Learning:** Using `role="radio"` and `aria-checked` on standard buttons without full radio keyboard logic (like arrow keys to cycle) creates an accessibility anti-pattern. Simple filter buttons should use `aria-pressed` instead.

**Action:** Replaced `role="radiogroup"`, `role="radio"`, and `aria-checked` with `aria-pressed` on the `TimeRangeSelector` filter buttons in `AnalyticsCharts.tsx`.
