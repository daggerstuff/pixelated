import { useMemo } from 'react'

type PasswordStrength = 'empty' | 'weak' | 'fair' | 'good' | 'strong'

interface PasswordStrengthInfo {
  strength: PasswordStrength
  score: number
  feedback: string
  color: string
}

function calculatePasswordStrength(password: string): PasswordStrengthInfo {
  if (!password) {
    return {
      strength: 'empty',
      score: 0,
      feedback: '',
      color: '#e2e8f0',
    }
  }

  let score = 0

  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[a-z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1
  if (/(.)\1{2,}/.test(password)) score -= 1
  if (/^[A-Za-z]+$/.test(password)) score -= 1
  if (/^[0-9]+$/.test(password)) score -= 1

  const commonPasswords = [
    'password',
    '123456',
    'qwerty',
    'letmein',
    'admin',
    'welcome',
  ]
  if (commonPasswords.includes(password.toLowerCase())) score = 0

  if (
    /(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(
      password,
    )
  ) {
    score -= 1
  }

  score = Math.max(0, Math.min(4, score))

  let strength: PasswordStrength
  let feedback: string
  let color: string

  switch (true) {
    case score === 0:
      strength = 'weak'
      feedback = 'Very weak - easy to guess'
      color = '#e53e3e'
      break
    case score === 1:
      strength = 'weak'
      feedback = 'Weak - easy to crack'
      color = '#e53e3e'
      break
    case score === 2:
      strength = 'fair'
      feedback = 'Fair - could be stronger'
      color = '#f6ad55'
      break
    case score === 3:
      strength = 'good'
      feedback = 'Good - strong password'
      color = '#68d391'
      break
    case score >= 4:
      strength = 'strong'
      feedback = 'Strong - excellent password'
      color = '#38a169'
      break
    case true: {
      throw new Error('Not implemented yet: true case')
    }
    default:
      strength = 'weak'
      feedback = 'Password could be stronger'
      color = '#e53e3e'
  }

  if (score < 3) {
    const suggestions: string[] = []
    if (password.length < 12) suggestions.push('longer password')
    if (!/[A-Z]/.test(password)) suggestions.push('uppercase letters')
    if (!/[a-z]/.test(password)) suggestions.push('lowercase letters')
    if (!/[0-9]/.test(password)) suggestions.push('numbers')
    if (!/[^A-Za-z0-9]/.test(password)) suggestions.push('special characters')
    if (suggestions.length > 0) {
      feedback += '. Add ' + suggestions.join(', ') + '.'
    }
  }

  return { strength, score, feedback, color }
}

/**
 * Hook for evaluating password strength
 * Returns password strength info for real-time user feedback
 */
export function usePasswordStrength(password: string): PasswordStrengthInfo {
  return useMemo(() => calculatePasswordStrength(password), [password])
}
