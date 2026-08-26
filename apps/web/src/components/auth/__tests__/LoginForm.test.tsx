import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LoginForm } from '../LoginForm'

const {
  useSessionMock,
  signInEmailMock,
  signInSocialMock,
  forgetPasswordMock,
  toastErrorMock,
  toastInfoMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  signInEmailMock: vi.fn(),
  signInSocialMock: vi.fn(),
  forgetPasswordMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastInfoMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}))

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: useSessionMock,
    signIn: {
      email: signInEmailMock,
      social: signInSocialMock,
    },
    forgetPassword: forgetPasswordMock,
  },
}))

vi.mock('@/components/ui/toast', () => ({
  toast: {
    error: toastErrorMock,
    info: toastInfoMock,
    success: toastSuccessMock,
  },
}))

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSessionMock.mockReturnValue({
      data: null,
      isPending: false,
      error: null,
    })
    signInEmailMock.mockResolvedValue({ error: null })
    signInSocialMock.mockResolvedValue(undefined)
    forgetPasswordMock.mockResolvedValue({ success: true })
  })

  it('marks the form as hydrated after mount', async () => {
    render(<LoginForm />)

    await waitFor(() => {
      expect(screen.getByTestId('login-form')).toHaveAttribute(
        'data-hydrated',
        'true',
      )
    })
  })

  it('shows validation errors when submitting an empty login form', async () => {
    render(<LoginForm />)

    const form = screen.getByTestId('login-form')

    await waitFor(() => {
      expect(form).toHaveAttribute('data-hydrated', 'true')
    })

    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeVisible()
      expect(screen.getByText('Password is required')).toBeVisible()
    })

    expect(toastErrorMock).toHaveBeenCalledWith(
      'Please correct the form errors',
    )
  })

  it('switches to reset mode when the forgot-password button is clicked', async () => {
    render(<LoginForm />)

    const form = screen.getByTestId('login-form')

    await waitFor(() => {
      expect(form).toHaveAttribute('data-hydrated', 'true')
    })

    fireEvent.click(screen.getByTestId('forgot-password-button'))

    await waitFor(() => {
      expect(screen.getByTestId('reset-password-heading')).toBeVisible()
    })
  })
})
