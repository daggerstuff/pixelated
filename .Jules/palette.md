## 2026-06-18 - Search Modal Accessibility

**Learning:** Search overlays often lack proper dialog ARIA roles, making them
invisible to screen readers.

**Action:** Added `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` to
the search modal in `HeaderReact.tsx`. Added `autoFocus={true}` to `SearchBox`
to trap focus on open.
