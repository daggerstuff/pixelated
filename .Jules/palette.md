## 2024-05-23 - Custom Switch Accessibility
**Learning:** Custom form controls built with a hidden input + visual div need `peer-focus-visible` classes on the visual element, not just `focus-visible`. The input is what receives focus, so the sibling (peer) needs to react to that state.
**Action:** When building custom checkboxes or radio buttons, always use the `peer` pattern and verify keyboard navigation.

## 2024-05-23 - Invisible Focus Traps
**Learning:** Elements hidden visually with `opacity: 0` are still focusable by keyboard, creating confusing "ghost" focus stops.
**Action:** Always pair visual hiding (opacity/visibility) with `tabindex="-1"` and `aria-hidden="true"` to remove them from the accessibility tree until they are visible.
