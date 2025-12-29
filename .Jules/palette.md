## 2024-05-23 - Custom Switch Accessibility
**Learning:** Custom form controls built with a hidden input + visual div need `peer-focus-visible` classes on the visual element, not just `focus-visible`. The input is what receives focus, so the sibling (peer) needs to react to that state.
**Action:** When building custom checkboxes or radio buttons, always use the `peer` pattern and verify keyboard navigation.

## 2024-12-24 - Hidden Interactive Elements
**Learning:** Elements hidden visually (e.g., via opacity) but remaining in the DOM must have `tabindex="-1"` and `aria-hidden="true"` to prevent keyboard users from tabbing to them. When they become visible, these attributes must be toggled back.
**Action:** Always check `ToTopButton` and similar toggleable widgets for initial `tabindex` state and script-based toggling.
