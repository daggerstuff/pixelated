import { useState, useEffect } from 'react'

type PasswordStrength = 'empty' | 'weak' | 'fair' | 'good' | 'strong'

interface PasswordStrengthInfo {
  strength: PasswordStrength
  score: number
  feedback: string
  color: string
}

/**
 * Hook for evaluating password strength
 * Returns password strength info for real-time user feedback
 */
export function usePasswordStrength(password: string): PasswordStrengthInfo {
  const [strengthInfo, setStrengthInfo] = useState<PasswordStrengthInfo>({
    strength: 'empty',
    score: 0,
    feedback: '',
    color: '#e2e8f0', // default gray
  })

  useEffect(() => {
    if (!password) {
      setStrengthInfo({
        strength: 'empty',
        score: 0,
        feedback: '',
        color: '#e2e8f0', // default gray
      })
      return
    }

    // Calculate password score
    let score = 0

    // Length check
    if (password.length >= 8) {
      score += 1
    }
    if (password.length >= 12) {
      score += 1
    }

    // Character variety
    if (/[A-Z]/.test(password)) {
      score += 1 // Has uppercase
    }
    if (/[a-z]/.test(password)) {
      score += 1 // Has lowercase
    }
    if (/[0-9]/.test(password)) {
      score += 1 // Has number
    }
    if (/[^A-Za-z0-9]/.test(password)) {
      score += 1 // Has special char
    }

    // Pattern detection
    if (/(.)\1{2,}/.test(password)) {
      score -= 1 // Repeating characters (e.g., 'aaa')
    }
    if (/^[A-Za-z]+$/.test(password)) {
      score -= 1 // Only letters
    }
    if (/^[0-9]+$/.test(password)) {
      score -= 1 // Only numbers
    }

    // Common password list check (simplified version)
    const commonPasswords = [
      'password',
      '123456',
      'qwerty',
      'letmein',
      'admin',
      'welcome',
    ]
    if (commonPasswords.includes(password.toLowerCase())) {
      score = 0 // Automatic weak if common password
    }

    // Sequential characters check
    if (
      /(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(
        password,
      )
    ) {
      score -= 1
    }

    // Normalize score to 0-4 range
    score = Math.max(0, Math.min(4, score))

    // Determine strength based on score
    let strength: PasswordStrength
    let feedback: string
    let color: string

    switch (true) {
      case score === 0:
        strength = 'weak'
        feedback = 'Very weak - easy to guess'
        color = '#e53e3e' // red
        break
      case score === 1:
        strength = 'weak'
        feedback = 'Weak - easy to crack'
        color = '#e53e3e' // red
        break
      case score === 2:
        strength = 'fair'
        feedback = 'Fair - could be stronger'
        color = '#f6ad55' // orange
        break
      case score === 3:
        strength = 'good'
        feedback = 'Good - strong password'
        color = '#68d391' // green
        break
      case score >= 4:
        strength = 'strong'
        feedback = 'Strong - excellent password'
        color = '#38a169' // dark green
        break
      default:
        strength = 'weak'
        feedback = 'Password could be stronger'
        color = '#e53e3e' // red
    }

    // Generate specific enhancement suggestions
    if (score < 3) {
      const suggestions = []

      if (password.length < 12) {
        suggestions.push('longer password')
      }
      if (!/[A-Z]/.test(password)) {
        suggestions.push('uppercase letters')
      }
      if (!/[a-z]/.test(password)) {
        suggestions.push('lowercase letters')
      }
      if (!/[0-9]/.test(password)) {
        suggestions.push('numbers')
      }
      if (!/[^A-Za-z0-9]/.test(password)) {
        suggestions.push('special characters')
      }

      if (suggestions.length > 0) {
        feedback += '. Add ' + suggestions.join(', ') + '.'
      }
    }

    setStrengthInfo({
      strength,
      score,
      feedback,
      color,
    })
  }, [password])

  return strengthInfo
}
