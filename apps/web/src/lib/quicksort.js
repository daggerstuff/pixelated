/* jshint esversion: 6, node: true */
// Quicksort implementation with optional comparator
// Exports: quicksort(array, comparator) -> returns a new sorted array

/**
 * Default comparator for numbers and strings.
 * @param {any} a
 * @param {any} b
 * @returns {number}
 */
function defaultCompare(a, b) {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/**
 * Quicksort that returns a new sorted array. Stable-ish for practical use.
 * Accepts an optional comparator(a, b) that returns negative/zero/positive.
 * This implementation avoids recursion depth issues by using an iterative stack for large arrays.
 *
 * @param {Array} arr
 * @param {(a:any,b:any)=>number} [comparator]
 * @returns {Array}
 */
function quicksort(array, comparator) {
  if (!Array.isArray(array))
    throw new TypeError('quicksort: first argument must be an array')
  const cmp = typeof comparator === 'function' ? comparator : defaultCompare
  // Work on a shallow copy so we don't mutate input
  const a = array.slice()
  if (a.length < 2) return a

  // In-place quicksort using manual stack to avoid deep recursion
  const stack = [{ left: 0, right: a.length - 1 }]

  while (stack.length) {
    const { left, right } = stack.pop()
    if (left >= right) continue

    // Choose pivot using median-of-three for better partitioning
    const mid = left + ((right - left) >> 1)
    const pivotCandidates = [a[left], a[mid], a[right]]
    // simple median
    pivotCandidates.sort((x, y) => cmp(x, y))
    const pivot = pivotCandidates[1]

    // Partition in-place
    let i = left
    let j = right
    while (i <= j) {
      while (cmp(a[i], pivot) < 0) i++
      while (cmp(a[j], pivot) > 0) j--
      if (i <= j) {
        const tmp = a[i]
        a[i] = a[j]
        a[j] = tmp
        i++
        j--
      }
    }

    // Push sub-partitions onto the stack
    if (left < j) stack.push({ left, right: j })
    if (i < right) stack.push({ left: i, right })
  }

  return a
}

module.exports = { quicksort }
