## 2025-05-23 - [O(1) LRU Cache Eviction]
**Learning:** In JavaScript, `Map` preserves insertion order. We can implement a highly efficient $O(1)$ LRU cache by simply deleting and re-inserting keys upon access, ensuring the oldest (least recently used) items are always at the beginning of the `keys()` iterator.
**Action:** Use `this.cache.delete(key)` followed by `this.cache.set(key, value)` to maintain LRU order without expensive $O(n)$ scans.
