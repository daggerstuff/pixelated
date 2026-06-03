## 2024-11-20 - Treatment Plan Colors O(1) Lookup Extraction | Learning: Repeated object/switch creation within mapping functions in render components creates small performance impacts | Action: Extract mapping objects for Priority and Status strings to static module scope mappings (`PRIORITY_COLORS_MAP`, `STATUS_COLORS_MAP`) for guaranteed O(1) access and 0 render-time allocations.

## 2024-05-15 - Extracted static tabIcons in AdminDashboard | Learning: Object extraction reduces render overhead | Action: Moved tabIcons out of AdminDashboard

## 2024-11-20 - Array Literals O(1) Lookup Extraction | Learning: Array literals defined inside a React component function are re-allocated on every render, which can cause unnecessary memory pressure and potentially trigger unnecessary re-renders in child components if passed as props. | Action: Extract static arrays (`timeRangeOptions`, `demographicFilterOptions`) outside the component to module scope.
