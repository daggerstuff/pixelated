import { useState, useEffect } from 'react'
import { debounce } from '@/utils/debounce'

/**
 * A hook that debounces a value by delaying updates until after a specified amount of time has passed
 * without any further updates.
 *
 * @param value The value to debounce
 * @param delay The delay in milliseconds (default: 300ms)
 * @returns The debounced value
 *
 * @example
 * ```tsx
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearchTerm = useDebounce(searchTerm, 500);
 *
 * // Effect only triggers when debouncedSearchTerm changes
 * useEffect(() => {
 *   performSearch(debouncedSearchTerm);
 * }, [debouncedSearchTerm]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    // Update debounced value after delay
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // Cancel the timeout if value changes or unmounts
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * A hook that returns a debounced callback function.
 *
 * @param callback The function to debounce
 * @param delay The delay in milliseconds (default: 300ms)
 * @param immediate If true, trigger the function on the leading edge instead of the trailing edge
 * @returns A debounced version of the callback function
 *
 * @example
 * ```tsx
 * const handleSearch = (query: string) => {
 *   performSearch(query);
 * };
 *
 * const debouncedSearch = useDebouncedCallback(handleSearch, 500);
 *
 * // Use the debounced function directly
 * return <input onChange={(e) => debouncedSearch(e.target.value)} />;
 * ```
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = 300,
  immediate: boolean = false,
): (...args: Parameters<T>) => void {
  return debounce(callback, delay, immediate)
}
