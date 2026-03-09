## 2025-05-15 - [O(1) Cache Optimization]
**Learning:** Standard cache implementations often default to O(N) operations for eviction and metrics calculation. By leveraging JavaScript's `Map` insertion order preservation, we can achieve O(1) performance for LRU/FIFO eviction and chronological expiration cleanup.
**Action:** Always consider the underlying data structure's properties (like `Map`'s insertion order) to avoid unnecessary iterations in performance-critical paths.

## 2025-05-15 - [Chronological Consistency in Caches]
**Learning:** When using an early-break optimization for expiration (O(1) best case), it's crucial that the data structure remains strictly chronological. In an LRU cache where accessed items are moved to the end, their timestamps MUST be updated to maintain this property, or the expiration logic must account for the shuffle.
**Action:** Ensure all operations that modify the order of a "chronological" collection also update the relevant sorting keys (e.g., timestamps).
