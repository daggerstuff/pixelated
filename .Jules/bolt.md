## 2024-11-20 - Treatment Plan Colors O(1) Lookup Extraction | Learning: Repeated object/switch creation within mapping functions in render components creates small performance impacts | Action: Extract mapping objects for Priority and Status strings to static module scope mappings (`PRIORITY_COLORS_MAP`, `STATUS_COLORS_MAP`) for guaranteed O(1) access and 0 render-time allocations.

## 2024-05-15 - Extracted static tabIcons in AdminDashboard | Learning: Object extraction reduces render overhead | Action: Moved tabIcons out of AdminDashboard

## 2024-06-04 - SystemTab Styles O(1) Lookup Extraction | Learning: Dynamic style object creation within mapping functions in render components creates small memory allocations and performance impacts | Action: Extract diagnostic issue severity styles to a static module scope mapping (`ISSUE_SEVERITY_STYLES`) for guaranteed O(1) access and 0 render-time allocations.

## 2024-11-20 - Pre-computation of formatting strings | Learning: Repeated object instantiation like `new Date()` combined with string formatting within mapping functions in render components creates performance impacts | Action: Extract string pre-computation into a mapped structure inside a useMemo.

## 2024-11-20 - Date Pre-compute for Checkpoints | Learning: Pre-compute date strings to avoid new Date() in render | Action: Extract pre-computation into useMemo
