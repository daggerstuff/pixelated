## 2025-05-23 - [O(1) Cache Operations]
**Learning:** In JavaScript, the `Map` object maintains insertion order. For LRU caches, this allows O(1) eviction of the least recently used item (the first entry) and O(1) amortized expiration of entries if the Map is kept in chronological order. Previous implementation used O(N) iteration for both LRU lookup and expiration.
**Action:** Always leverage `Map.prototype.keys().next().value` for O(1) LRU eviction and use early-break patterns in expiration loops when the underlying collection is chronologically sorted.
