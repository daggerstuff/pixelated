import { useSecurityStore } from './stores/securityStore'
import { usePreferencesStore } from './stores/preferencesStore'
import { useAppDataStore } from './stores/appDataStore'

export const useStore = useSecurityStore as unknown as typeof useSecurityStore &
  typeof usePreferencesStore &
  typeof useAppDataStore

export { useSecurityStore, usePreferencesStore, useAppDataStore }

usePreferencesStore.subscribe(
  (state) => state.preferences.theme,
  (theme) => {
    if (typeof window !== 'undefined') {
      const root = document.documentElement
      root.classList.remove('light', 'dark')
      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        root.classList.add(prefersDark ? 'dark' : 'light')
      } else {
        root.classList.add(theme)
      }
    }
  },
)

usePreferencesStore.subscribe(
  (state) => state.preferences.accessibility,
  (accessibility) => {
    if (typeof window !== 'undefined') {
      const root = document.documentElement
      if (accessibility.reducedMotion) { root.style.setProperty('--motion-reduce', '1') } else { root.style.removeProperty('--motion-reduce') }
      if (accessibility.highContrast) { root.classList.add('high-contrast') } else { root.classList.remove('high-contrast') }
      root.classList.remove('font-small', 'font-medium', 'font-large')
      root.classList.add(`font-${accessibility.fontSize}`)
    }
  },
)

if (typeof window !== 'undefined') {
  useAppDataStore.getState().incrementSessionCount()
  window.addEventListener('beforeunload', () => {
    useAppDataStore.getState().recordSessionEnd()
    useAppDataStore.getState().updateLastActivity()
  })
  const updateActivity = () => useAppDataStore.getState().updateLastActivity()
  window.addEventListener('mousedown', updateActivity)
  window.addEventListener('keydown', updateActivity)
  window.addEventListener('scroll', updateActivity)
  window.addEventListener('touchstart', updateActivity)
}
