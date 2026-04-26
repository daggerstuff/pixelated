## 2024-06-01 - Extract Tooltip
| Learning: Inline components in Recharts cause unnecessary re-renders.
| Action: Extracted CustomTooltip to module level.

## 2026-04-24 - SearchFilters Optimization
| Learning: Array.includes inside map loops causes O(N²) renders.
| Action: Used useMemo to convert array to Set for O(1) lookups.
