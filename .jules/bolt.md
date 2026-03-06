## 2025-05-15 - Optimized Cache Eviction and Metrics in PerformanceOptimizer

**Learning:** Implementing O(1) LRU eviction in a JavaScript `Map` requires both re-insertion to maintain order and updating the entry's timestamp in the `get` method to ensure the `evictExpired` logic (which breaks at the first non-expired entry) remains correct for a sliding window.

**Action:** When using `Map` insertion order for LRU, always update the entry's timestamp upon access if using an optimized early-break expiration strategy.
