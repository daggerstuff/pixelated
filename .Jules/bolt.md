## 2024-06-01 - Extract Tooltip | Learning: Inline components in Recharts cause unnecessary re-renders. | Action: Extracted CustomTooltip to module level.
## 2024-06-03 - O(N^2) React Rendering | Learning: Array.includes() inside .map() loops causes O(N^2) bottlenecks during React renders. | Action: Replaced Array.includes() with a Set generated via useMemo for O(1) lookups.

## 2024-06-04 - Memoize Emotion Stats | Learning: Re-rendering due to checkbox toggles recalculates expensive derived state. | Action: Added useMemo for calculating emotion data averages.
