## 2025-03-05 - Optimized ChatMessage component

**Learning:** Chat messages in a long conversation frequently re-render unnecessarily when the parent container updates (e.g., during AI typing or when new messages are added). Lifting static helpers and using React.memo provides a significant performance boost for long-lived sessions.

**Action:** Wrap frequently rendered list items in React.memo and move non-reactive logic outside the component body.
