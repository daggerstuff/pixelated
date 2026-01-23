import { createElement as h, useState, ChangeEvent, FormEvent, ReactNode } from 'react';
import { LoginSchema } from '@/lib/validation/loginSchema';

export default function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState({
    email: '',
    password: '',
  });

  const schema = LoginSchema;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUser(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = schema.safeParse(user);
    if (!result.success) {
      setError(result.error.errors[0].message);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(result.data),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Sign in failed');
        setIsLoading(false);
        return;
      }

      // On success, redirect to dashboard or home
      window.location.href = '/dashboard';
    } catch (error) {
      setError('Network error. Please try again.');
      setIsLoading(false);
    }
  };

  const fields: Array<'email' | 'password'> = ['email', 'password'];

  const fieldInputs: ReactNode[] = fields.map(field => {
    const isEmail = field === 'email';
    return h('div', { key: field, className: 'mb-4' },
      h('label', {
        className: 'block text-sm font-medium text-gray-700',
        htmlFor: field,
      }, isEmail ? 'Email Address' : 'Password'),
      h('input', {
        type: isEmail ? 'email' : 'password',
        name: field,
        value: user[field],
        onChange: handleChange,
        autoComplete: isEmail ? 'email' : 'current-password',
        className: 'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:ring-offset-0',
        required: true,
      }),
      !isEmail && h('p', { className: 'text-xs text-gray-400 indent-2 mt-1' },
        'Must be at least 6 characters'
      )
    );
  });

  return h('div', { className: 'auth-container max-w-md w-full p-6 bg-white rounded-lg shadow-md' },
    h('h2', { className: 'text-2xl font-bold mb-6 text-center' }, 'Sign In'),
    h('form', { className: 'space-y-4', onSubmit: handleSubmit },
      ...fieldInputs,
      error && h('div', { className: 'mb-4 p-3 bg-red-100 text-red-800 rounded-lg', role: 'alert' }, error),
      h('button', {
        type: 'submit',
        disabled: isLoading,
        className: 'w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-75 transition-colors',
      }, isLoading ? 'Signing in...' : 'Sign In')
    ),
    h('div', { className: 'mt-6 text-center' },
      h('span', { className: 'text-sm text-gray-500' }, "Don't have an account?"),
      h('a', {
        href: '/register',
        className: 'text-sm text-indigo-600 hover:text-indigo-500 underline',
      }, 'Sign up')
    )
  );
}
