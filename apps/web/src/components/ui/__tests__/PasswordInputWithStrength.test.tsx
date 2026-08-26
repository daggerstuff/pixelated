// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, expect, it, afterEach } from 'vitest'

import { PasswordInputWithStrength } from '../PasswordInputWithStrength'

import '@testing-library/jest-dom/vitest'

describe('PasswordInputWithStrength', () => {
  afterEach(() => cleanup())

  it('renders password input with strength indicator', () => {
    render(
      <PasswordInputWithStrength
        label="Password"
        name="password"
        value="initial"
      />,
    )
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(
      screen.getByRole('progressbar', { name: /password strength/i }),
    ).toBeInTheDocument()
  })

  it('updates strength meter when value changes', () => {
    const { rerender } = render(
      <PasswordInputWithStrength
        label="Password"
        name="password"
        value="123"
      />,
    )

    expect(
      screen.getByRole('progressbar', { name: /password strength/i }),
    ).toBeInTheDocument()

    rerender(
      <PasswordInputWithStrength
        label="Password"
        name="password"
        value="StrongPass123!"
      />,
    )

    expect(
      screen.getByRole('progressbar', { name: /password strength/i }),
    ).toHaveAttribute('id', 'password-strength')
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
