<!-- markdownlint-disable MD013 MD026 -->

## 2024-06-01 - Extract Tooltip

Learning: Inline components in Recharts cause unnecessary re-renders.
Action: Extracted `CustomTooltip` to module level.

## 2024-06-03 - O(N^2) React Rendering

Learning: `Array.includes()` inside `.map()` loops causes O(N²) bottlenecks during React renders.
Action: Replaced `Array.includes()` with a `Set` generated via `useMemo` for O(1) lookups.

## 2024-05-18 - Stable Reference for Checkbox Toggles

Learning: Functions passed to looped DOM elements cause unnecessary allocations.
Action: Wrapped handleDimensionToggle in useCallback.

## 2025-03-20 - Set for Filters

Learning: `Array.includes()` inside `.map()` loops causes O(N²) bottlenecks during React renders when rendering filter lists.
Action: Replaced `Array.includes()` with `Set.has()` using `useMemo` for filter option arrays.

## 2025-03-20 - Inline Callback Re-renders

## 2024-05-18 - Stable Reference for Checkbox Toggles | Learning: Functions passed to looped DOM elements cause unnecessary allocations | Action: Wrapped handleDimensionToggle in useCallback

## 2025-03-20 - Inline Callback Re-renders

- Learning: Inline arrow functions passed as props to child components cause unnecessary re-renders. When using useCallback to memoize state updater callbacks, use the functional update pattern to avoid adding state variables to the dependency array.
- Action: Wrapped inline patient selection handler in useCallback using a functional state update.

## 2024-05-18 - Avoid O(N) filtering on every render | Learning: Array methods like .filter() and .find() in the component body without memoization lead to O(N) operations per render. | Action: Wrapped filteredGoals and activeGoal derivations in useMemo hooks.
