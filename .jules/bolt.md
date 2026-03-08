# Bolt's Journal - Critical Performance Learnings

## 2025-05-21 - O(1) Cache and Metrics Optimization
**Learning:** In a performance-critical service like `PerformanceOptimizer`, iterating over a large cache for metrics (like `cacheHitRate`) or eviction (LRU search) creates an O(n) bottleneck that scales poorly. JavaScript's `Map` insertion-order property can be leveraged to implement O(1) LRU and O(1) amortized expiration.
**Action:** Use running counters for metrics and `Map.keys().next().value` for O(1) eviction of the oldest/least-recently-used items.
