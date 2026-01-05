## 2024-05-23 - Custom Switch Accessibility
**Learning:** Custom form controls built with a hidden input + visual div need `peer-focus-visible` classes on the visual element, not just `focus-visible`. The input is what receives focus, so the sibling (peer) needs to react to that state.
**Action:** When building custom checkboxes or radio buttons, always use the `peer` pattern and verify keyboard navigation.

## 2024-05-24 - Hiding Interactive Elements
**Learning:** Using `opacity-0` and `pointer-events-none` is not enough to hide elements from keyboard users (who can still tab to them) or screen readers. You must also manage `tabindex="-1"` and `aria-hidden="true"`, or use `visibility: hidden`.
**Action:** When implementing "fade in" elements like a "Scroll to Top" button, ensure you toggle `tabindex` and `aria-hidden` states alongside the visual transition.
