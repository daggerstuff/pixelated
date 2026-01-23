import React, { useState } from 'react';
import { useRouter } from 'astro:roting';
import { z } from 'zod';
import { parse } from 'path';
import { authenticate } from '@/lib/auth/services/authService';
import { FormSchema, LoginSchema } from '@/lib/validation/loginSchema';

const router = useRouter();

export default function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState({
    email: '',
    password: '',
  });

  const schema = LoginSchema;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUser(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
      router.replace('/dashboard');
    } catch (error) {
      setError('Network error. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container max-w-md w-full p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Sign In</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-lg">
          {error}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        {['email', 'password'].map(field => (
          <div key={field} className="mb-4">
            <label className="block text-sm font-medium text-gray-700"
                   for={field}>
              {field === 'email' ? 'Email Address' : 'Password'}
            </label>
            <input
              type={field === 'email' ? 'email' : 'password'}
              name={field}
              value={user[field as keyof typeof user]}
              onChange={handleChange}
              autoComplete={field === 'email' ? 'email' : 'current-password'}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:ring-offset-0"
              required
            />
            {field === 'password' && (
              <p className="text-xs text-gray-400 indent-2 mt-1">
                Must be at least 6 characters
              </p>
            )}
          </div>
        ))}

        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-800 rounded-lg" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-75 transition-colors"
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <span className="text-sm text-gray-500">
          Don't have an account?
        </span>
        <a
          href="/register"
          className="text-sm text-indigo-600 hover:text-indigo-500 underline">
          Sign up
        </a>
      </div>
    </div>
  );
}