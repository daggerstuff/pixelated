import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PasswordInputWithStrength } from '../PasswordInputWithStrength'
import React from 'react'

// Mock the hook to control strength
vi.mock('../../hooks/usePasswordStrength', () => ({
  usePasswordStrength: vi.fn((password: string) => {
    if (!password) {
      return { strength: 'empty', score: 0, feedback: '', color: '#e2e8f0' }
    }
    // Return a fixed value that we can reliably test against
    return { strength: 'fair', score: 2, feedback: 'Fair - could be stronger', color: '#f6ad55' }
  }),
}))

describe('PasswordInputWithStrength', () => {
  it('renders label and input', () => {
    render(
      <PasswordInputWithStrength
        label="Password"
        name="password"
      />
    )
    // Use selector to avoid matching the button title
    expect(screen.getByLabelText('Password', { selector: 'input' })).toBeInTheDocument()
  })

  it('shows error even when focused', () => {
    const { container } = render(
      <PasswordInputWithStrength
        label="Password"
        name="password"
        error="Invalid password"
      />
    )

    const input = screen.getByLabelText('Password', { selector: 'input' })
    fireEvent.focus(input)

    // Error label should be present and announced as an alert
    const errorAlert = screen.getByRole('alert')
    expect(errorAlert).toHaveTextContent('Invalid password')

    // aria-invalid should be true
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('has correct ARIA attributes for strength meter', () => {
    render(
      <PasswordInputWithStrength
        label="Password"
        name="password"
        value="password123"
      />
    )

    const progressbar = screen.getByRole('progressbar')
    expect(progressbar.getAttribute('aria-label')).toBe('Password strength')
    expect(progressbar.getAttribute('aria-valuetext')).toBe('fair')
  })

  it('has aria-live="polite" on feedback text', () => {
    render(
      <PasswordInputWithStrength
        label="Password"
        name="password"
        value="password123"
        showStrengthText={true}
      />
    )

    // Check for aria-live="polite" on the element containing the feedback
    const feedback = screen.getByText(/Fair - could be stronger/i)
    expect(feedback.getAttribute('aria-live')).toBe('polite')
  })

  it('includes error in aria-describedby when error exists', () => {
    render(
      <PasswordInputWithStrength
        label="Password"
        name="password"
        error="Required"
        helperText="Enter your password"
      />
    )

    const input = screen.getByLabelText('Password', { selector: 'input' })
    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).toContain('password-error')
    expect(describedBy).toContain('password-helper')
  })
})