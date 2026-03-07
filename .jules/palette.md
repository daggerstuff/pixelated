## 2025-05-15 - Icon-only Button Accessibility
**Learning:** Icon-only buttons (like Bell, Check, X) are invisible to screen readers and confusing to users without explicit labels. In React/Radix environments, combining 'aria-label' for screen readers with 'Tooltip' for visual users provides a complete accessibility solution.
**Action:** Always pair 'aria-label' with a 'Tooltip' for 'size="icon"' buttons to ensure both screen reader and mouse/keyboard accessibility.
