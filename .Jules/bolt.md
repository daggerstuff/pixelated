## 2024-11-20 - Treatment Plan Colors O(1) Lookup Extraction | Learning: Repeated object/switch creation within mapping functions in render components creates small performance impacts | Action: Extract mapping objects for Priority and Status strings to static module scope mappings (`PRIORITY_COLORS_MAP`, `STATUS_COLORS_MAP`) for guaranteed O(1) access and 0 render-time allocations.

## 2024-05-15 - Extracted static tabIcons in AdminDashboard | Learning: Object extraction reduces render overhead | Action: Moved tabIcons out of AdminDashboard

## 2024-11-20 - Extracted Static Maps O(1) Lookup Extraction | Learning: Static icon/style mapping objects defined inside render methods are unnecessarily recreated on every render | Action: Moved `TAB_ICONS` out of `EnhancedBiasDetectionInterface` functional component in `EnhancedBiasDetectionInterface.tsx` to module level.
