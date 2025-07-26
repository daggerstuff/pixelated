import React, { useState, useEffect } from 'react'
import { useDebounce, useDebouncedCallback } from '@/hooks/useDebounce'

const DebounceDemoComponent: React.FC = () => {
  // For useDebounce hook demo
  const [inputValue1, setInputValue1] = useState('')
  const debouncedValue = useDebounce(inputValue1, 500)
  const [debouncedResult1, setDebouncedResult1] = useState('')

  // For useDebouncedCallback hook demo
  const [inputValue2, setInputValue2] = useState('')
  const [debouncedResult2, setDebouncedResult2] = useState('')

  // Handler for the useDebouncedCallback demo
  const handleDebouncedChange = useDebouncedCallback((...args: unknown[]) => {
    const value = args[0] as string
    setDebouncedResult2(value)
  }, 500)

  // Update the result whenever debouncedValue changes
  useEffect(() => {
    setDebouncedResult1(debouncedValue)
  }, [debouncedValue])

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        Debounce Hooks Demo
      </h1>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
          useDebounce Hook Demo
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Type in the input below. The debounced value will update 500ms after
          you stop typing.
        </p>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="input1"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Input Value:
            </label>
            <input
              id="input1"
              type="text"
              value={inputValue1}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setInputValue1(e.target.value)
              }
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Type something..."
            />

            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Current value: &ldquo;{inputValue1}&rdquo;
            </div>
          </div>

          <div>
            <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Debounced Value:
            </div>
            <div
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-900"
              role="status"
              aria-live="polite"
            >
              {debouncedResult1}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
          useDebouncedCallback Hook Demo
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          This demo uses the debounced callback. The output updates 500ms after
          you stop typing.
        </p>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="input2"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Input Value:
            </label>
            <input
              id="input2"
              type="text"
              value={inputValue2}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const newValue = e.target.value
                setInputValue2(newValue)
                handleDebouncedChange(newValue)
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Type something..."
            />

            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Current value: &ldquo;{inputValue2}&rdquo;
            </div>
          </div>

          <div>
            <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Debounced Result:
            </div>
            <div
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-900"
              role="status"
              aria-live="polite"
            >
              {debouncedResult2}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DebounceDemoComponent
