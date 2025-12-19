import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { RegisterForm } from '../RegisterForm'
import { useAuth } from '../../../hooks/useAuth'
import userEvent from '@testing-library/user-event'

// Mock the useAuth hook
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

describe('RegisterForm', () => {
  const mockSignUp = vi.fn()
  const mockSignInWithOAuth = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAuth as vi.Mock).mockImplementation(() => ({
      signUp: mockSignUp,
      signInWithOAuth: mockSignInWithOAuth,
    }))
  })

  it('renders the form with proper accessibility attributes', () => {
    render(<RegisterForm />)

    // Check that all form elements have the correct aria attributes
    const nameInput = screen.getByLabelText(/full name/i)
    expect(nameInput).toHaveAttribute('aria-required', 'true')

    const emailInput = screen.getByLabelText(/email/i)
    expect(emailInput).toHaveAttribute('aria-required', 'true')

    const passwordInput = screen.getByLabelText(/^Password/i)
    expect(passwordInput).toHaveAttribute('aria-required', 'true')
    // Expecting password-helper because the input is empty initially
    expect(passwordInput).toHaveAttribute('aria-describedby', 'password-helper')

    const termsCheckbox = screen.getByLabelText(/i agree to the/i)
    expect(termsCheckbox).toHaveAttribute('aria-required', 'true')
    expect(termsCheckbox).toHaveAttribute('aria-invalid', 'false')
  })

  it('shows and announces error messages appropriately', async () => {
    render(<RegisterForm />)

    // Try to submit the form without filling it
    const submitButton = screen.getByRole('button', { name: /create account/i })
    fireEvent.click(submitButton)

    // Check for error messages
    await waitFor(() => {
      expect(screen.getByText(/full name is required/i)).toBeInTheDocument()
      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
      expect(screen.getByText(/you must accept the terms/i)).toBeInTheDocument()
    })

    // Check that error messages have proper ARIA attributes
    const errors = screen.getAllByRole('alert')
    errors.forEach((error) => {
      expect(error).toHaveAttribute('role', 'alert')
    })
  })

  it('announces loading state to screen readers', async () => {
    mockSignUp.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    )
    render(<RegisterForm />)

    // Fill out the form
    await userEvent.type(screen.getByLabelText(/full name/i), 'John Doe')
    await userEvent.type(screen.getByLabelText(/email/i), 'john@example.com')
    await userEvent.type(screen.getByLabelText(/^Password/i), 'password123')
    await userEvent.click(screen.getByLabelText(/i agree to the/i))

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /create account/i })
    fireEvent.click(submitButton)

    // Check loading state announcement
    await waitFor(() => {
      expect(screen.getByText(/creating your account/i)).toBeInTheDocument()
      expect(submitButton).toHaveAttribute('aria-busy', 'true')
    })
  })

  it('announces successful registration', async () => {
    mockSignUp.mockResolvedValue({ success: true, user: { id: '1' } })
    render(<RegisterForm />)

    // Fill out and submit the form
    await userEvent.type(screen.getByLabelText(/full name/i), 'John Doe')
    await userEvent.type(screen.getByLabelText(/email/i), 'john@example.com')
    await userEvent.type(screen.getByLabelText(/^Password/i), 'password123')
    await userEvent.click(screen.getByLabelText(/i agree to the/i))
    await userEvent.click(
      screen.getByRole('button', { name: /create account/i }),
    )

    // Check success message
    await waitFor(() => {
      const successMessage = screen.getByRole('alert')
      expect(successMessage).toHaveTextContent(/registration successful/i)
      expect(successMessage).toHaveAttribute('aria-live', 'polite')
    })
  })

  it('provides accessible links for Terms and Privacy Policy', () => {
    render(<RegisterForm />)

    const termsLink = screen.getByRole('link', { name: /terms of service/i })
    expect(termsLink).toHaveAttribute(
      'aria-label',
      'Terms of Service (opens in new tab)',
    )
    expect(termsLink).toHaveAttribute('rel', 'noopener noreferrer')

    const privacyLink = screen.getByRole('link', { name: /privacy policy/i })
    expect(privacyLink).toHaveAttribute(
      'aria-label',
      'Privacy Policy (opens in new tab)',
    )
    expect(privacyLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('makes Google sign-in button accessible', () => {
    render(<RegisterForm />)

    const googleButton = screen.getByRole('button', {
      name: /sign up with google/i,
    })
    expect(googleButton).toHaveAttribute('aria-label', 'Sign up with Google')

    const googleLogo = screen.getByRole('img', { name: /google logo/i })
    expect(googleLogo).toBeInTheDocument()
  })

  it('allows keyboard access to password visibility toggle', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    const nameInput = screen.getByLabelText(/full name/i)
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/^Password/i)
    const toggleButton = screen.getByRole('button', { name: /show password/i })

    expect(toggleButton).toBeInTheDocument()

    await user.tab()
    expect(nameInput).toHaveFocus()

    await user.tab()
    expect(emailInput).toHaveFocus()

    await user.tab()
    expect(passwordInput).toHaveFocus()

    await user.tab()
    expect(toggleButton).toHaveFocus()
  })
})
