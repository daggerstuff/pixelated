// Simple quicksort implementation (in-place) with exported function
function quicksort(arr, left = 0, right = arr.length - 1) {
    if (!Array.isArray(arr)) throw new TypeError('Expected an array')
    if (left >= right) return arr

    const pivotIndex = partition(arr, left, right)
    quicksort(arr, left, pivotIndex - 1)
    quicksort(arr, pivotIndex + 1, right)
    return arr
}

function partition(arr, left, right) {
    const pivot = arr[right]
    let i = left - 1
    for (let j = left; j < right; j++) {
        if (arr[j] <= pivot) {
            i += 1
                ;[arr[i], arr[j]] = [arr[j], arr[i]]
        }
    }
    ;[arr[i + 1], arr[right]] = [arr[right], arr[i + 1]]
    return i + 1
}

// Export for CommonJS and ESM
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { quicksort }
}
export { quicksort }
