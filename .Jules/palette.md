## 2024-05-23 - Custom Switch Accessibility
**Learning:** Custom form controls built with a hidden input + visual div need `peer-focus-visible` classes on the visual element, not just `focus-visible`. The input is what receives focus, so the sibling (peer) needs to react to that state.
**Action:** When building custom checkboxes or radio buttons, always use the `peer` pattern and verify keyboard navigation.
## 2024-05-24 - Duplicate Components
**Learning:** Found duplicate components in `src/components/ui` and `src/components/widgets`. `ToTopButton` exists in both, but only the widget one is used in `BaseLayout`. Always verify active imports before editing.
**Action:** When modifying a component, grep for its usage first to ensure you are editing the active version.
