import {
  createElement as h,
  useState,
  ChangeEvent,
  SyntheticEvent,
  ReactNode,
} from 'react'

import { LoginSchema } from '@/lib/validation/loginSchema'

export default function LoginForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState({
    email: '',
    password: '',
  })

  const schema = LoginSchema

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setUser((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const result = schema.safeParse(user)
    if (!result.success) {
      setError(result.error.issues?.[0]?.message ?? 'Validation failed')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(result.data),
      })

      const data = (await response.json()) as { error?: string }

      if (!response.ok) {
        setError(data.error ?? 'Sign in failed')
        setIsLoading(false)
        return
      }

      // On success, redirect to dashboard or home
      window.location.assign('/dashboard')
    } catch (error) {
      setError('Network error. Please try again.')
      setIsLoading(false)
    }
  }

  const fields: Array<'email' | 'password'> = ['email', 'password']

  const fieldInputs: ReactNode[] = fields.map((field) => {
    const isEmail = field === 'email'
    return h(
      'div',
      { key: field, className: 'mb-4' },
      h(
        'label',
        {
          className: 'block text-sm font-medium text-foreground',
          htmlFor: field,
        },
        isEmail ? 'Email Address' : 'Password',
      ),
      h('input', {
        type: isEmail ? 'email' : 'password',
        name: field,
        value: user[field],
        onChange: handleChange,
        autoComplete: isEmail ? 'email' : 'current-password',
        className:
          'mt-1 border-input bg-background w-full rounded-none border focus:border-ring focus:ring-ring sm:ring-offset-0',
        required: true,
      }),
      !isEmail &&
        h(
          'p',
          { className: 'text-xs text-muted-foreground indent-2 mt-1' },
          'Must be at least 6 characters',
        ),
    )
  })

  return h(
    'div',
    {
      className:
        'auth-container max-w-md w-full p-6 bg-card border border-border rounded-none',
    },
    h('h2', { className: 'text-2xl font-bold mb-6 text-center' }, 'Sign In'),
    h(
      'form',
      { className: 'space-y-4', onSubmit: handleSubmit },
      ...fieldInputs,
      error &&
        h(
          'div',
          {
            className:
              'mb-4 p-3 bg-secondary border border-ring text-foreground rounded-none',
            role: 'alert',
          },
          error,
        ),
      h(
        'button',
        {
          type: 'submit',
          disabled: isLoading,
          className:
            'w-full bg-primary text-primary-foreground py-2 px-4 rounded-none hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-35 transition-colors',
        },
        isLoading ? 'Signing in...' : 'Sign In',
      ),
    ),
    h(
      'div',
      { className: 'mt-6 text-center' },
      h(
        'span',
        { className: 'text-sm text-muted-foreground' },
        "Don't have an account?",
      ),
      h(
        'a',
        {
          href: '/register',
          className: 'text-sm text-foreground hover:underline',
        },
        'Sign up',
      ),
    ),
  )
}
