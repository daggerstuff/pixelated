import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { toast } from '../ui/toast'

export default function PasswordResetRequestForm() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      toast.error('Email is required')
      return
    }

    setIsLoading(true)

    try {
      // Show loading toast
      const loadingToastId = toast.loading('Sending password reset email...')

      // Send password reset request
      const response = await authClient.forgetPassword({
        email,
        redirectTo: `${window.location.origin}/auth-callback`,
      })

      // Dismiss loading toast
      toast.dismiss(loadingToastId)

      if (!response.error) {
        // Dispatch custom success event that will be caught by the Astro component
        document.dispatchEvent(
          new CustomEvent('password-reset-request-success'),
        )

        // Clear the form
        setEmail('')
      } else {
        throw new Error(response.error.message || 'Failed to send password reset email')
      }
    } catch (error: unknown) {
      let errorMessage = 'An error occurred while requesting password reset'

      if (error instanceof Error) {
        errorMessage = String(error)
      }

      // Dispatch custom error event that will be caught by the Astro component
      document.dispatchEvent(
        new CustomEvent('password-reset-request-error', {
          detail: { message: errorMessage },
        }),
      )

      console.error('Password reset request error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setEmail(e.target.value)
          }
          required
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Enter your email"
        />
      </div>

      <div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="loading-spinner"></span>
              <span>Sending...</span>
            </span>
          ) : (
            <span>Send Reset Link</span>
          )}
        </button>
      </div>

      <div className="text-center mt-4">
        <a href="/login" className="text-sm text-primary hover:underline">
          Back to login
        </a>
      </div>
    </form>
  )
}
