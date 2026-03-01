import React, { useState } from 'react'

export default function RegisterForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState({
    email: '',
    password: '',
    fullName: '',
    termsAccepted: false,
  })

  // Simple validation without external schema
  const validateForm = () => {
    if (!user.email || !user.email.includes('@')) {
      return 'Please enter a valid email address'
    }
    if (!user.password || user.password.length < 6) {
      return 'Password must be at least 6 characters'
    }
    if (!user.fullName || user.fullName.trim().length === 0) {
      return 'Please enter your full name'
    }
    if (!user.termsAccepted) {
      return 'You must accept the Terms of Service'
    }
    return null
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setUser((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(user),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Registration failed')
        setIsLoading(false)
        return
      }

      // On success, redirect to login or dashboard
      window.location.assign('/login')
    } catch {
      setError('Network error. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className='auth-container bg-white w-full max-w-md rounded-lg p-6 shadow-md'>
      <h2 className='mb-6 text-center text-2xl font-bold'>Create Account</h2>

      {error && (
        <div
          className='bg-red-100 text-red-800 mb-4 rounded-lg p-3'
          role='alert'
        >
          {error}
        </div>
      )}

      <form className='space-y-4' onSubmit={handleSubmit}>
        {['fullName', 'email', 'password', 'termsAccepted'].map((field) => (
          <div key={field} className='mb-4'>
            {(() => {
              switch (field) {
                case 'fullName':
                  return (
                    <>
                      <label
                        className='text-gray-700 block text-sm font-medium'
                        htmlFor={field}
                      >
                        Full Name
                      </label>
                      <input
                        id={field}
                        type='text'
                        name={field}
                        value={user[field as keyof typeof user] as string}
                        onChange={handleChange}
                        className='border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 mt-1 block w-full rounded-md shadow-sm sm:ring-offset-0'
                        required
                      />
                    </>
                  )
                case 'email':
                  return (
                    <>
                      <label
                        className='text-gray-700 block text-sm font-medium'
                        htmlFor={field}
                      >
                        Email Address
                      </label>
                      <input
                        id={field}
                        type='email'
                        name={field}
                        value={user[field as keyof typeof user] as string}
                        onChange={handleChange}
                        autoComplete='email'
                        className='border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 mt-1 block w-full rounded-md shadow-sm sm:ring-offset-0'
                        required
                      />
                      <p className='text-gray-400 mt-1 text-xs'>
                        Must be a valid email address
                      </p>
                    </>
                  )
                case 'password':
                  return (
                    <>
                      <label
                        className='text-gray-700 block text-sm font-medium'
                        htmlFor={field}
                      >
                        Password
                      </label>
                      <input
                        id={field}
                        type='password'
                        name={field}
                        value={user[field as keyof typeof user] as string}
                        onChange={handleChange}
                        className='border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 mt-1 block w-full rounded-md shadow-sm sm:ring-offset-0'
                        required
                      />
                      <p className='text-gray-400 mt-1 text-xs'>
                        Must be at least 6 characters
                      </p>
                    </>
                  )
                case 'termsAccepted':
                  return (
                    <>
                      <div className='flex items-center space-x-2'>
                        <input
                          id={field}
                          type='checkbox'
                          name={field}
                          checked={user[field]}
                          onChange={handleChange}
                          className='border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 h-4 w-4 rounded-md shadow-sm sm:ring-offset-0'
                        />
                        <label
                          htmlFor={field}
                          className='text-gray-500 text-sm'
                        >
                          I agree to the
                          <a
                            href='/terms'
                            className='text-indigo-600 hover:text-indigo-500 text-sm underline'
                          >
                            Terms of Service
                          </a>
                        </label>
                      </div>
                      <p
                        className='text-gray-400 text-red-500 mt-1 hidden text-xs'
                        id='terms-error'
                      >
                        You must accept the Terms of Service
                      </p>
                    </>
                  )
                default:
                  return null
              }
            })()}
          </div>
        ))}

        {error && (
          <div
            className='bg-red-100 text-red-800 mb-4 rounded-lg p-2'
            role='alert'
          >
            {error}
          </div>
        )}

        <button
          type='submit'
          disabled={isLoading}
          className='bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 w-full rounded-md px-4 py-2 transition-colors focus:outline-none focus:ring-2 disabled:opacity-75'
        >
          {isLoading ? 'Creating Account...' : 'Register'}
        </button>
      </form>

      <div className='mt-6 text-center'>
        <span className='text-gray-500 text-sm'>Already have an account?</span>
        <a
          href='/login'
          className='text-indigo-600 hover:text-indigo-500 text-sm underline'
        >
          Sign in
        </a>
      </div>
    </div>
  )
}
