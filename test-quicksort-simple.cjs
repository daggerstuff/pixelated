// Simple test for quicksort bugs - CommonJS version
const { quicksort } = require('./src/lib/quicksort.js')

console.log('Testing quicksort...')

// Test basic functionality
try {
  const arr = [3, 1, 4, 1, 5, 9, 2, 6]
  const result = quicksort(arr)
  console.log('Original:', arr)
  console.log('Sorted:', result)
  console.log('Is sorted?', JSON.stringify(result) === JSON.stringify([1,1,2,3,4,5,6,9]))
} catch (e) {
  console.error('Basic test failed:', e.message)
}

// Test edge cases
try {
  console.log('Empty array:', quicksort([]))
  console.log('Single element:', quicksort([42]))
  console.log('Two elements:', quicksort([2, 1]))
} catch (e) {
  console.error('Edge case failed:', e.message)
}

// Test with null/undefined
try {
  const result = quicksort([3, null, 1, undefined, 2])
  console.log('With null/undefined:', result)
} catch (e) {
  console.error('Null/undefined test failed:', e.message)
}

// Test with all same elements
try {
  const result = quicksort([5, 5, 5, 5])
  console.log('All same elements:', result)
} catch (e) {
  console.error('Same elements test failed:', e.message)
}