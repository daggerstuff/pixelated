## 2025-05-15 - [Static Helper Allocation Anti-pattern]
**Learning:** Defining helper functions that don't depend on component state or props inside the component body causes them to be re-allocated on every render. In high-frequency components like `ChatMessage` in a chat list, this adds unnecessary overhead and garbage collection pressure.
**Action:** Always move non-reactive helper functions outside the component scope or memoize them if they must stay inside. Use `React.memo` for components rendered in large lists to skip redundant re-renders.
