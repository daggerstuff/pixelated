/** @jsxImportSource react */
import React from 'react'
import { Toast } from './toast'

/**
 * ToastProvider component to provide toast notifications functionality.
 * This component should be placed near the root of your application.
 * Only renders on the client side to avoid SSR issues.
 */
export default function ToastProvider() {
  // Only render on client side to prevent SSR issues with react-hot-toast
  if (typeof window === 'undefined') {
    return null
  }

  return (
    <Toast
      position="bottom-right"
      toastOptions={{
        // Default duration
        duration: 4000,

        // Custom styling for different toast types
        success: {
          duration: 3000,
          className: 'border-l-4 border-green-500',
        },
        error: {
          duration: 5000,
          className: 'border-l-4 border-red-500',
        },
        loading: {
          duration: Infinity,
          className: 'border-l-4 border-blue-500',
        },
      }}
      className="max-w-md"
    />
  )
}
