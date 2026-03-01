import React, { useEffect } from 'react'

interface MobileDrawerProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function MobileDrawer({ isOpen, onClose, children }: MobileDrawerProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.body.style.overflow = 'hidden'
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <>
      {/* Backdrop */}
      <button
        className='bg-gray-900 fixed inset-0 z-40 border-0 bg-opacity-50 lg:hidden'
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onClose()
          }
        }}
        aria-label='Close menu'
      />

      {/* Drawer */}
      <div className='bg-white dark:bg-gray-800 fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-300 ease-in-out lg:hidden'>
        <div className='h-full overflow-y-auto px-3 py-4'>
          <button
            onClick={onClose}
            className='text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-600 dark:hover:text-white absolute right-2.5 top-2.5 inline-flex items-center rounded-lg p-1.5 text-sm'
          >
            <svg className='h-5 w-5' fill='currentColor' viewBox='0 0 20 20'>
              <path
                fillRule='evenodd'
                d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                clipRule='evenodd'
              />
            </svg>
          </button>
          {children}
        </div>
      </div>
    </>
  )
}
