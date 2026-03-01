import { useState, useEffect, type FC } from 'react'

import { useDebounce, useDebouncedCallback } from '@/hooks/useDebounce'

const DebounceDemoComponent: FC = () => {
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
    <div className='bg-white dark:bg-gray-800 mx-auto max-w-2xl rounded-lg p-6 shadow-lg'>
      <h1 className='text-gray-900 dark:text-white mb-6 text-2xl font-bold'>
        Debounce Hooks Demo
      </h1>

      <div className='mb-8'>
        <h2 className='text-gray-800 dark:text-gray-200 mb-4 text-xl font-semibold'>
          useDebounce Hook Demo
        </h2>
        <p className='text-gray-600 dark:text-gray-400 mb-4 text-sm'>
          Type in the input below. The debounced value will update 500ms after
          you stop typing.
        </p>

        <div className='space-y-4'>
          <div>
            <label
              htmlFor='input1'
              className='text-gray-700 dark:text-gray-300 mb-1 block text-sm font-medium'
            >
              Input Value:
            </label>
            <input
              id='input1'
              type='text'
              value={inputValue1}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setInputValue1(e.target.value)
              }
              className='border-gray-300 dark:border-gray-700 focus:ring-blue-500 dark:bg-gray-700 dark:text-white w-full rounded-md border px-4 py-2 focus:outline-none focus:ring-2'
              placeholder='Type something...'
            />

            <div className='text-gray-500 dark:text-gray-400 mt-1 text-sm'>
              Current value: &ldquo;{inputValue1}&rdquo;
            </div>
          </div>

          <div>
            <div className='text-gray-700 dark:text-gray-300 mb-1 block text-sm font-medium'>
              Debounced Value:
            </div>
            <div
              className='border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-md border px-4 py-2'
              role='status'
              aria-live='polite'
            >
              {debouncedResult1}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className='text-gray-800 dark:text-gray-200 mb-4 text-xl font-semibold'>
          useDebouncedCallback Hook Demo
        </h2>
        <p className='text-gray-600 dark:text-gray-400 mb-4 text-sm'>
          This demo uses the debounced callback. The output updates 500ms after
          you stop typing.
        </p>

        <div className='space-y-4'>
          <div>
            <label
              htmlFor='input2'
              className='text-gray-700 dark:text-gray-300 mb-1 block text-sm font-medium'
            >
              Input Value:
            </label>
            <input
              id='input2'
              type='text'
              value={inputValue2}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const newValue = e.target.value
                setInputValue2(newValue)
                handleDebouncedChange(newValue)
              }}
              className='border-gray-300 dark:border-gray-700 focus:ring-blue-500 dark:bg-gray-700 dark:text-white w-full rounded-md border px-4 py-2 focus:outline-none focus:ring-2'
              placeholder='Type something...'
            />

            <div className='text-gray-500 dark:text-gray-400 mt-1 text-sm'>
              Current value: &ldquo;{inputValue2}&rdquo;
            </div>
          </div>

          <div>
            <div className='text-gray-700 dark:text-gray-300 mb-1 block text-sm font-medium'>
              Debounced Result:
            </div>
            <div
              className='border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-md border px-4 py-2'
              role='status'
              aria-live='polite'
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
