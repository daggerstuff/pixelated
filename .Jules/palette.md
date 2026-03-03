## 2026-03-03 - [Icon Button Accessibility Pattern]
**Learning:** Multiple components in this repository (NotificationCenter, TreatmentPlanManager, DLPRulesList) use icon-only buttons without proper ARIA labels or tooltips, creating a consistent accessibility gap for screen reader users and a lack of hover feedback for others.
**Action:** Always verify that 'size="icon"' buttons include both 'aria-label' for screen readers and 'title' for visual tooltips in future enhancements.
