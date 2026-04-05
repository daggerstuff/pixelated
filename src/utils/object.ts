function isPrimitive(value: any): boolean {
  return value === null || typeof value !== "object";
}

type IdentityStrategy = (item: any) => string;

/**
 * Generate a stable identity key for an item so array merge can deduplicate by
 * value identity rather than reference.
 *
 * Priority (fastest → slowest):
 *  1. `id` property — O(1), most reliable for domain objects.
 *  2. Shallow hash of own properties — O(K) where K = own key count.
 *     Primitive values are included verbatim; non-primitive values contribute
 *     their key name + typeof tag, so objects whose leaves are all nested
 *     still get a stable, cheap key.
 *  3. JSON.stringify with circular-reference protection — only reached for
 *     objects that are completely empty (zero own keys). Deterministic fallback.
 *  4. 'fallback_unique' — only when serialisation throws (e.g. BigInt values);
 *     items with this key are always appended (never deduplicated).
 *
 * Performance note: callers should ensure frequently-updated domain objects
 * carry an `id` property to stay in the O(1) fast path and avoid hashing cost
 * entirely.
 */
const COMMON_IDENTITY_FIELDS = [
  "id",
  "_id",
  "uuid",
  "key",
  "uri",
  "path",
  "urn",
  "email",
  "username",
  "slug",
];

/**
 * Generate a stable identity key for an item so array merge can deduplicate by
 * value identity rather than reference.
 *
 * Priority (fastest → slowest):
 *  1. Common ID fields — O(1), most reliable for domain objects.
 *  2. Shallow hash of own properties — O(K) where K = own key count.
 *     Primitive values are included verbatim; non-primitive values contribute
 *     a type marker to keep hashing cheap.
 *  3. JSON.stringify with circular-reference protection — only reached for
 *     objects that are completely empty (zero own keys). Deterministic fallback.
 *  4. 'fallback_unique' — only when serialisation throws (e.g. BigInt values).
 *
 * Performance note: callers should ensure frequently-updated domain objects
 * carry an `id` or other common identity field to stay in the O(1) fast path.
 */
const getIdentityKey: IdentityStrategy = (item) => {
  if (isPrimitive(item)) {
    return `prim:${String(item)}`;
  }

  // Phase 1: O(1) fast-path for common identity markers.
  for (const field of COMMON_IDENTITY_FIELDS) {
    if (field in item) {
      const val = item[field];
      if (isPrimitive(val) && val !== null) {
        return `id:${val}`;
      }
    }
  }

  // Phase 2: Shallow hash — O(K) where K = own key count.
  // We limit the number of keys processed to 20 to prevent O(N*K) degradation
  // for extremely large object schemas while maintaining enough entropy for
  // most deduplication cases.
  const keys = Object.keys(item);
  if (keys.length > 0) {
    let hash = "";
    const maxKeys = Math.min(keys.length, 20);
    for (let i = 0; i < maxKeys; i++) {
      const key = keys[i];
      const val = item[key];
      if (isPrimitive(val)) {
        hash += `${key}:${String(val)}|`;
      } else {
        // Just use type marker for nested values to keep hashing O(1) per key.
        hash += `${key}:${Array.isArray(val) ? "arr" : "obj"}|`;
      }
    }
    return `hash:${hash}`;
  }

  // Only reached for objects with zero own keys (completely empty `{}`).
  try {
    const seen = new Set<object>();
    const safeReplacer = (_: string, val: unknown) => {
      if (val !== null && typeof val === "object") {
        if (seen.has(val as object)) return "[Circular]";
        seen.add(val as object);
      }
      return val;
    };
    return `json:${JSON.stringify(item, safeReplacer)}`;
  } catch {
    return "fallback_unique";
  }
};

/**
 * Merge two arrays by identity key, producing a stable result where:
 *  - All local items are kept at their original indices (Phase 1).
 *  - Remote items that share a key with a local item are deep-merged into that
 *    local slot (Phase 2, using the pre-snapshot index from `localSnapshot`).
 *  - Remote items with new keys are appended.
 *  - Items whose key is 'fallback_unique' are never deduplicated.
 *
 * Performance: identity keying costs O(K) per item where K = own key count.
 * For large arrays, callers should ensure items carry an explicit `id` property
 * to hit the O(1) fast path in `getIdentityKey` and avoid the hash loop.
 */
function mergeArrayElements<T>(
  local: any[],
  remote: any[],
  depth: number,
  visited: WeakSet<object>,
): T {
  // Phase 1: build result from local items only — indices become stable here.
  const result: any[] = [];
  const seenKeys = new Set<string>();

  // Map key → stable index in result[]
  const itemMap = new Map<string, number>();

  for (const item of local) {
    const key = getIdentityKey(item);
    const isFallback = key === "fallback_unique";

    if (!isFallback && seenKeys.has(key)) continue;

    const index = result.length;
    result.push(item);

    if (!isFallback) {
      seenKeys.add(key);
      itemMap.set(key, index);
    }
  }

  // Snapshot the map entries so we look up stable indices from the local pass.
  const localSnapshot = new Map(itemMap);

  // Phase 2: incorporate remote items. All index reads come from localSnapshot,
  // so remote deduplication never observes partially-merged state.
  const mergedIndices = new Set<number>();

  for (const item of remote) {
    const key = getIdentityKey(item);
    const isFallback = key === "fallback_unique";

    if (!isFallback && localSnapshot.has(key)) {
      // Key already exists — deep-merge remote into the local entry if both are objects.
      const index = localSnapshot.get(key)!;
      if (!mergedIndices.has(index)) {
        mergedIndices.add(index);
        const existingItem = result[index];
        if (!isPrimitive(existingItem) && !isPrimitive(item)) {
          result[index] = mergeValues(existingItem, item, depth + 1, visited);
        }
        // Primitives: remote wins only when they differ — but key equality already
        // covers identical primitives, so no change needed.
      }
      continue;
    }

    // New key (or fallback) — append without deduplication concern.
    if (!isFallback && seenKeys.has(key)) continue;

    if (!isFallback) seenKeys.add(key);
    result.push(item);
  }

  return result as unknown as T;
}

/**
 * Deep value merging strategy for cross-tab state synchronisation.
 *
 * Behaviour by type:
 *  - **Primitives** (either side): the remote value wins. Primitives cannot be
 *    meaningfully combined — the remote value represents the latest authoritative
 *    write.
 *  - **Arrays** (both sides): merged by identity key via `mergeArrayElements`.
 *    Local items retain their positions; remote items are merged into matching
 *    slots or appended as new entries.
 *  - **Objects** (both sides): shallow-spread local into a copy, then recurse
 *    into keys that are non-primitive on both sides; remote wins for all other
 *    keys.
 *  - **Circular references**: detected via `visited` WeakSet; the remote value
 *    is returned for any already-seen object to prevent infinite recursion.
 *  - **Depth guard**: returns `remote` when recursion exceeds 20 levels.
 *
 * This is *not* a symmetric merge — it is intentionally biased toward the
 * remote (incoming) value for scalars and conflict resolution, while
 * preserving local structure where both sides are mergeable collections.
 */
export function mergeValues<T>(local: T, remote: T, depth = 0, visited = new WeakSet<object>()): T {
  if (depth > 20) {
    return remote;
  }

  if (isPrimitive(local) || isPrimitive(remote)) {
    return remote;
  }

  if (visited.has(local as object) || visited.has(remote as object)) {
    return remote;
  }

  visited.add(local as object);
  visited.add(remote as object);

  if (Array.isArray(local) && Array.isArray(remote)) {
    return mergeArrayElements<T>(local, remote, depth, visited);
  }

  if (local && remote && !isPrimitive(local) && !isPrimitive(remote)) {
    const merged = { ...local } as Record<string, any>;
    for (const [key, value] of Object.entries(remote as object)) {
      if (merged[key] && !isPrimitive(merged[key]) && !isPrimitive(value)) {
        merged[key] = mergeValues(merged[key], value, depth + 1, visited);
      } else {
        merged[key] = value;
      }
    }
    return merged as T;
  }

  return remote;
}

/**
 * Deep equality check for objects and arrays
 * Handles nested objects, arrays, and primitive values
 */
export function deepEqual<T>(a: T, b: T): boolean {
  // Strict equality for primitives and same reference
  if (a === b) return true;

  // Handle null/undefined
  if (a == null || b == null) return a === b;

  // Must be same type
  if (typeof a !== typeof b) return false;

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  // Handle objects
  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);

    if (keysA.length !== keysB.length) return false;

    // Handle objects - use hasOwnProperty for O(1) key lookups without Set allocation overhead
    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b as object, key)) return false;
      if (!deepEqual((a as any)[key], (b as any)[key])) return false;
    }
    return true;
  }

  return false;
}
