## 2025-05-15 - [Accessible and Visible Form Validation]
**Learning:** For mobile and screen reader users, keeping error messages visible while the input is focused is critical for maintaining context. Floating error labels should use the general sibling selector `~` to ensure they appear even when intermediate elements (like show/hide password buttons) are present in the DOM.

**Action:** Always verify that `aria-invalid` and `.error-label` visibility is maintained during focus, and ensure progress-based components (like strength meters) use `aria-valuetext` for human-readable feedback.
