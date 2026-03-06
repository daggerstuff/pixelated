## 2025-03-07 - [Memoized ChatMessage and Markdown Parsing]

**Learning:** In a chat application, rapid keystrokes in the input field trigger re-renders of the entire message list. If messages are not memoized, this leads to O(n) re-renders where n is the number of messages. Furthermore, if each message re-parses its Markdown on every re-render, the performance degradation is even more significant.
**Action:** Always wrap chat message components in `React.memo` and use `useMemo` for expensive operations like Markdown-to-HTML conversion.
