// Test cases to identify quicksort bugs
const { quicksort } = require('./src/lib/quicksort.js')
import { quicksort as quicksortES } from './src/lib/utils/quicksort.js'

console.log('Testing quicksort implementations for bugs...')

// Test 1: Empty array
try {
  const result1 = quicksort([])
  console.log('Empty array test:', result1)
} catch (e) {
  console.error('Empty array bug:', e.message)
}

// Test 2: Single element
try {
  const result2 = quicksort([42])
  console.log('Single element test:', result2)
} catch (e) {
  console.error('Single element bug:', e.message)
}

// Test 3: Array with null/undefined
try {
  const result3 = quicksort([3, null, 1, undefined, 2])
  console.log('Null/undefined test:', result3)
} catch (e) {
  console.error('Null/undefined bug:', e.message)
}

// Test 4: Array with duplicates
try {
  const result4 = quicksort([3, 1, 3, 2, 1])
  console.log('Duplicates test:', result4)
} catch (e) {
  console.error('Duplicates bug:', e.message)
}

// Test 5: Large array (performance test)
try {
  const largeArray = Array.from({length: 10000}, () => Math.floor(Math.random() * 1000))
  const result5 = quicksort(largeArray)
  console.log('Large array test: length =', result5.length)
} catch (e) {
  console.error('Large array bug:', e.message)
}

// Test 6: Already sorted array
try {
  const sorted = [1, 2, 3, 4, 5]
  const result6 = quicksort(sorted)
  console.log('Already sorted test:', result6)
} catch (e) {
  console.error('Already sorted bug:', e.message)
}