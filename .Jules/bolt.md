## 2024-06-01 - Extract Tooltip | Learning: Inline components in Recharts cause unnecessary re-renders. | Action: Extracted CustomTooltip to module level.

## 2024-06-03 - O(N^2) React Rendering | Learning: Array.includes() inside .map() loops causes O(N^2) bottlenecks during React renders. | Action: Replaced Array.includes() with a Set generated via useMemo for O(1) lookups.

## 2025-03-20 - Set for Filters | Learning: `Array.includes()` inside `.map()` loops causes O(N^2) bottlenecks during React renders when rendering filter lists. | Action: Replaced `Array.includes()` with `Set.has()` using `useMemo` for filter option arrays.

## 2025-03-20 - Inline Callback Re-renders | Learning: Inline arrow functions passed as props to child components cause unnecessary re-renders. When using useCallback to memoize state updater callbacks, it's critical to use the functional update pattern (e.g. prev => prev.includes(...)) to avoid adding state variables to the dependency array, which would otherwise invalidate the memoization on every state change. | Action: Wrapped inline patient selection handler in useCallback using a functional state update.
