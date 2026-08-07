export const PREMIUM_STORAGE_KEY = 'premium_unlocked'

export function isPremium(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem(PREMIUM_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function setPremium(unlocked = true): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(PREMIUM_STORAGE_KEY, unlocked ? 'true' : 'false')
  } catch {
    // Ignore quota or privacy-mode errors.
  }
}

export function clearPremium(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.removeItem(PREMIUM_STORAGE_KEY)
  } catch {
    // Ignore storage access errors.
  }
}
