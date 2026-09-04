import { create } from 'zustand'
import { devtools, subscribeWithSelector, persist } from 'zustand/middleware'

interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  language: string
  notifications: { email: boolean; push: boolean; sms: boolean }
  accessibility: { reducedMotion: boolean; highContrast: boolean; fontSize: 'small' | 'medium' | 'large' }
  privacy: { analytics: boolean; crashReporting: boolean; personalization: boolean }
}

interface UIState {
  sidebarOpen: boolean
  activeTab: string
  layout: 'default' | 'compact' | 'expanded'
  viewMode: 'list' | 'grid' | 'card'
  filters: Record<string, unknown>
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

interface PreferencesState {
  preferences: UserPreferences
  uiState: UIState

  updatePreferences: (preferences: Partial<UserPreferences>) => void
  setTheme: (theme: UserPreferences['theme']) => void
  setLanguage: (language: string) => void
  updateNotificationSettings: (notifications: Partial<UserPreferences['notifications']>) => void
  updateAccessibilitySettings: (accessibility: Partial<UserPreferences['accessibility']>) => void
  updatePrivacySettings: (privacy: Partial<UserPreferences['privacy']>) => void
  updateUIState: (uiState: Partial<UIState>) => void
  toggleSidebar: () => void
  setActiveTab: (tab: string) => void
  setLayout: (layout: UIState['layout']) => void
  setViewMode: (viewMode: UIState['viewMode']) => void
  updateFilters: (filters: Record<string, unknown>) => void
  setSortBy: (sortBy: string, sortOrder?: UIState['sortOrder']) => void
}

const defaultPreferences: UserPreferences = {
  theme: 'dark',
  language: 'en',
  notifications: { email: true, push: true, sms: false },
  accessibility: { reducedMotion: false, highContrast: false, fontSize: 'medium' },
  privacy: { analytics: true, crashReporting: true, personalization: true },
}

const defaultUIState: UIState = {
  sidebarOpen: true,
  activeTab: 'dashboard',
  layout: 'default',
  viewMode: 'list',
  filters: {},
  sortBy: 'date',
  sortOrder: 'desc',
}

export const usePreferencesStore = create<PreferencesState>()(
  devtools(
    subscribeWithSelector(
      persist(
        (set): PreferencesState => ({
          preferences: defaultPreferences,
          uiState: defaultUIState,

          updatePreferences: (prefs) => set((state) => ({ preferences: { ...state.preferences, ...prefs } })),
          setTheme: (theme) => set((state) => ({ preferences: { ...state.preferences, theme } })),
          setLanguage: (language) => set((state) => ({ preferences: { ...state.preferences, language } })),
          updateNotificationSettings: (notifications) => set((state) => ({
            preferences: { ...state.preferences, notifications: { ...state.preferences.notifications, ...notifications } },
          })),
          updateAccessibilitySettings: (accessibility) => set((state) => ({
            preferences: { ...state.preferences, accessibility: { ...state.preferences.accessibility, ...accessibility } },
          })),
          updatePrivacySettings: (privacy) => set((state) => ({
            preferences: { ...state.preferences, privacy: { ...state.preferences.privacy, ...privacy } },
          })),
          updateUIState: (ui) => set((state) => ({ uiState: { ...state.uiState, ...ui } })),
          toggleSidebar: () => set((state) => ({ uiState: { ...state.uiState, sidebarOpen: !state.uiState.sidebarOpen } })),
          setActiveTab: (tab) => set((state) => ({ uiState: { ...state.uiState, activeTab: tab } })),
          setLayout: (layout) => set((state) => ({ uiState: { ...state.uiState, layout } })),
          setViewMode: (viewMode) => set((state) => ({ uiState: { ...state.uiState, viewMode } })),
          updateFilters: (filters) => set((state) => ({ uiState: { ...state.uiState, filters: { ...state.uiState.filters, ...filters } } })),
          setSortBy: (sortBy, sortOrder: UIState['sortOrder'] = 'desc') => set((state): Partial<PreferencesState> => ({ uiState: { ...state.uiState, sortBy, sortOrder } })),
        }),
        {
          name: 'therapy-state-preferences',
          partialize: (state) => ({ preferences: state.preferences, uiState: state.uiState }),
        },
      ),
    ),
  ),
)
