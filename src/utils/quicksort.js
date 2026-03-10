/**
 * QuickSort implementation in JavaScript
 * @param {number[]} arr - Array of numbers to sort
 * @returns {number[]} - Sorted array
 */
function quicksort(arr) {
  if (arr.length <= 1) {
    return arr
  }

  const pivot = arr[Math.floor(arr.length / 2)]
  const left = []
  const right = []
  const equal = []

  for (const element of arr) {
    if (element < pivot) {
      left.push(element)
    } else if (element > pivot) {
      right.push(element)
    } else {
      equal.push(element)
    }
  }

  return [...quicksort(left), ...equal, ...quicksort(right)]
}

export { quicksort }
