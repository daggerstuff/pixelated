## 2025-02-18 - Keyboard Accessibility for Toggle Buttons
**Learning:** Functional toggle buttons (like password visibility) often get excluded from tab order (`tabIndex="-1"`) by mistake, assuming users only click them. This completely blocks keyboard users.
**Action:** Always ensure interactive elements are focusable. Use `aria-label` for context and test tab navigation.
