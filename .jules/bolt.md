# Bolt's Performance Journal ⚡

## 2025-03-03 - Chat Interface O(N) Re-render Bottleneck
**Learning:** In React chat applications, parent state updates (like typing in a ChatInput) can trigger re-renders of the entire message history. If each message component performs expensive operations like Markdown parsing or complex string manipulation without memoization, performance degrades linearly as the conversation grows.
**Action:** Always wrap chat message components in `React.memo` and use `useMemo` for content transformations (e.g., Markdown-to-HTML) to ensure $O(1)$ re-render cost during active typing.
