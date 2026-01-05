/**
 * Quicksort implementation (in-place on a copy) with optional comparator.
 * Returns a new sorted array and does not mutate the input.
 *
 * @template T
 * @param {T[]} arr - Array to sort
 * @param {(a:T,b:T)=>number} [compareFn] - Optional comparator: negative if a<b, 0 if equal, positive if a>b
 * @returns {T[]} Sorted array (new array)
 */
export function quicksort(arr, compareFn) {
  if (!Array.isArray(arr)) {
    throw new TypeError('quicksort expects an array')
  }

  const cmp =
    typeof compareFn === 'function'
      ? compareFn
      : (a, b) => {
          if (a === b) return 0
          // Handle undefined/null safely
          if (a == null) return -1
          if (b == null) return 1
          // Use localeCompare for strings for a better ordering
          if (typeof a === 'string' && typeof b === 'string')
            return a.localeCompare(b)
          return a < b ? -1 : 1
        }

  // Make a shallow copy to avoid mutating the input
  const array = arr.slice()

  // Iterative quicksort using stack to avoid recursion depth issues on large arrays
  const stack = [{ left: 0, right: array.length - 1 }]

  while (stack.length) {
    const { left, right } = stack.pop()
    if (left >= right) continue

    // Partition
    const pivotIndex = Math.floor((left + right) / 2)
    const pivot = array[pivotIndex]
    let i = left
    let j = right

    while (i <= j) {
      while (cmp(array[i], pivot) < 0) i++
      while (cmp(array[j], pivot) > 0) j--
      if (i <= j) {
        // swap
        const tmp = array[i]
        array[i] = array[j]
        array[j] = tmp
        i++
        j--
      }
    }

    // Push subranges
    if (left < j) stack.push({ left, right: j })
    if (i < right) stack.push({ left: i, right })
  }

  return array
}

// Default export for convenience
export default quicksort

/*
Example usage:

import quicksort from './quicksort.js'

const nums = [5, 3, 8, 1, 2]
console.log(quicksort(nums)) // [1,2,3,5,8]

const objs = [{v:3},{v:1},{v:2}]
console.log(quicksort(objs, (a,b)=>a.v-b.v)) // sorted by v

*/
