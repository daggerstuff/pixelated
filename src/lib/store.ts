import type { AIService } from './ai/models/ai-types'
import type { FHEService } from './fhe'
import { create } from 'zustand'
import { createMentalHealthChat } from './chat'
import { devtools } from 'zustand/middleware'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { logger } from './logger'

// ============================================================================
// Enhanced State Types
// ============================================================================

interface OfflineAction {
  id: string
  type: string
  payload: unknown
  timestamp: number
  retryCount: number
}

interface SessionState {
  lastRoute: string
  currentWorkspace: string | null
  openTabs: string[]
  recentItems: string[]
  searchHistory: string[]
  lastActivity: number
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  language: string
  notifications: {
    email: boolean
    push: boolean
    sms: boolean
  }
  accessibility: {
    reducedMotion: boolean
    highContrast: boolean
    fontSize: 'small' | 'medium' | 'large'
  }
  privacy: {
    analytics: boolean
    crashReporting: boolean
    personalization: boolean
  }
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

interface UsageStats {
  sessionCount: number
  totalTimeSpent: number
  featureUsage: Record<string, number>
  lastSessionEnd: number | null
  performanceMetrics: {
    averageLoadTime: number
    errorCount: number
    crashCount: number
  }
}

interface StoreState {
  // Security settings
  securityLevel: 'standard' | 'hipaa' | 'maximum'
  encryptionEnabled: boolean
  fheInitialized: boolean

  // AI service
  aiService: AIService

  // FHE Service
  fheService: FHEService | null

  // Mental Health Chat
  mentalHealthChat: ReturnType<typeof createMentalHealthChat> | null
  mentalHealthAnalysisEnabled: boolean
  expertGuidanceEnabled: boolean

  // Enhanced State - User Preferences
  preferences: UserPreferences

  // Enhanced State - UI State
  uiState: UIState

  // Enhanced State - Session State
  sessionState: SessionState

  // Enhanced State - Offline Queue
  offlineQueue: OfflineAction[]

  // Enhanced State - Form Drafts
  formDrafts: Record<string, { data: unknown; timestamp: number }>

  // Enhanced State - Usage Analytics
  usageStats: UsageStats

  // Original Actions
  setSecurityLevel: (level: 'standard' | 'hipaa' | 'maximum') => void
  setEncryptionEnabled: (enabled: boolean) => void
  setFHEInitialized: (initialized: boolean) => void
  setAIService: (service: AIService) => void
  initializeMentalHealthChat: () => ReturnType<
    typeof createMentalHealthChat
  > | null
  configureMentalHealthAnalysis: (
    enableAnalysis: boolean,
    useExpertGuidance: boolean,
  ) => void

  // Enhanced Actions - User Preferences
  updatePreferences: (preferences: Partial<UserPreferences>) => void
  setTheme: (theme: UserPreferences['theme']) => void
  setLanguage: (language: string) => void
  updateNotificationSettings: (
    notifications: Partial<UserPreferences['notifications']>,
  ) => void
  updateAccessibilitySettings: (
    accessibility: Partial<UserPreferences['accessibility']>,
  ) => void
  updatePrivacySettings: (privacy: Partial<UserPreferences['privacy']>) => void

  // Enhanced Actions - UI State
  updateUIState: (uiState: Partial<UIState>) => void
  toggleSidebar: () => void
  setActiveTab: (tab: string) => void
  setLayout: (layout: UIState['layout']) => void
  setViewMode: (viewMode: UIState['viewMode']) => void
  updateFilters: (filters: Record<string, unknown>) => void
  setSortBy: (sortBy: string, sortOrder?: UIState['sortOrder']) => void

  // Enhanced Actions - Session State
  updateSessionState: (sessionState: Partial<SessionState>) => void
  setCurrentRoute: (route: string) => void
  setCurrentWorkspace: (workspace: string | null) => void
  addOpenTab: (tab: string) => void
  removeOpenTab: (tab: string) => void
  addRecentItem: (item: string) => void
  addSearchHistory: (query: string) => void
  updateLastActivity: () => void

  // Enhanced Actions - Offline Queue
  queueOfflineAction: (type: string, payload: unknown) => void
  removeOfflineAction: (id: string) => void
  clearOfflineQueue: () => void

  // Enhanced Actions - Form Drafts
  saveDraft: (formId: string, data: unknown) => void
  getDraft: (formId: string) => unknown | null
  clearDraft: (formId: string) => void
  clearAllDrafts: () => void

  // Enhanced Actions - Usage Analytics
  trackFeatureUsage: (featureName: string) => void
  incrementSessionCount: () => void
  recordSessionEnd: () => void
  updatePerformanceMetric: (
    metric: keyof UsageStats['performanceMetrics'],
    value: number,
  ) => void
}

// ============================================================================
// Default Values
// ============================================================================

const defaultPreferences: UserPreferences = {
  theme: 'dark',
  language: 'en',
  notifications: {
    email: true,
    push: true,
    sms: false,
  },
  accessibility: {
    reducedMotion: false,
    highContrast: false,
    fontSize: 'medium',
  },
  privacy: {
    analytics: true,
    crashReporting: true,
    personalization: true,
  },
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

const defaultSessionState: SessionState = {
  lastRoute: '/',
  currentWorkspace: null,
  openTabs: [],
  recentItems: [],
  searchHistory: [],
  lastActivity: Date.now(),
}

const defaultUsageStats: UsageStats = {
  sessionCount: 0,
  totalTimeSpent: 0,
  featureUsage: {},
  lastSessionEnd: null,
  performanceMetrics: {
    averageLoadTime: 0,
    errorCount: 0,
    crashCount: 0,
  },
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useStore = create<StoreState>()(
  devtools(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          // Original state
          securityLevel: 'hipaa',
          encryptionEnabled: true,
          fheInitialized: false,
          aiService: null as unknown as AIService,
          fheService: null,
          mentalHealthChat: null,
          mentalHealthAnalysisEnabled: true,
          expertGuidanceEnabled: true,

          // Enhanced state
          preferences: defaultPreferences,
          uiState: defaultUIState,
          sessionState: defaultSessionState,
          offlineQueue: [],
          formDrafts: {},
          usageStats: defaultUsageStats,

          // Original actions
          setSecurityLevel: (level) => set({ securityLevel: level }),
          setEncryptionEnabled: (enabled) =>
            set({ encryptionEnabled: enabled }),
          setFHEInitialized: (initialized) =>
            set({ fheInitialized: initialized }),
          setAIService: (service) => set({ aiService: service }),
          initializeMentalHealthChat: () => {
            if (get().fheService) {
              const mentalHealthChat = createMentalHealthChat(
                get().fheService as FHEService,
                {
                  enableAnalysis: get().mentalHealthAnalysisEnabled,
                  useExpertGuidance: get().expertGuidanceEnabled,
                },
              )
              set({ mentalHealthChat })
              return mentalHealthChat
            }
            return null
          },
          configureMentalHealthAnalysis: (
            enableAnalysis: boolean,
            useExpertGuidance: boolean,
          ) => {
            set({
              mentalHealthAnalysisEnabled: enableAnalysis,
              expertGuidanceEnabled: useExpertGuidance,
            })

            const { mentalHealthChat } = get()
            if (mentalHealthChat) {
              mentalHealthChat.configure({
                enableAnalysis,
                useExpertGuidance,
              })
            }
          },

          // Enhanced actions - User Preferences
          updatePreferences: (preferences) =>
            set((state) => ({
              preferences: { ...state.preferences, ...preferences },
            })),
          setTheme: (theme) =>
            set((state) => ({
              preferences: { ...state.preferences, theme },
            })),
          setLanguage: (language) =>
            set((state) => ({
              preferences: { ...state.preferences, language },
            })),
          updateNotificationSettings: (notifications) =>
            set((state) => ({
              preferences: {
                ...state.preferences,
                notifications: {
                  ...state.preferences.notifications,
                  ...notifications,
                },
              },
            })),
          updateAccessibilitySettings: (accessibility) =>
            set((state) => ({
              preferences: {
                ...state.preferences,
                accessibility: {
                  ...state.preferences.accessibility,
                  ...accessibility,
                },
              },
            })),
          updatePrivacySettings: (privacy) =>
            set((state) => ({
              preferences: {
                ...state.preferences,
                privacy: { ...state.preferences.privacy, ...privacy },
              },
            })),

          // Enhanced actions - UI State
          updateUIState: (uiState) =>
            set((state) => ({
              uiState: { ...state.uiState, ...uiState },
            })),
          toggleSidebar: () =>
            set((state) => ({
              uiState: {
                ...state.uiState,
                sidebarOpen: !state.uiState.sidebarOpen,
              },
            })),
          setActiveTab: (tab) =>
            set((state) => ({
              uiState: { ...state.uiState, activeTab: tab },
            })),
          setLayout: (layout) =>
            set((state) => ({
              uiState: { ...state.uiState, layout },
            })),
          setViewMode: (viewMode) =>
            set((state) => ({
              uiState: { ...state.uiState, viewMode },
            })),
          updateFilters: (filters) =>
            set((state) => ({
              uiState: {
                ...state.uiState,
                filters: { ...state.uiState.filters, ...filters },
              },
            })),
          setSortBy: (sortBy, sortOrder = 'desc') =>
            set((state) => ({
              uiState: { ...state.uiState, sortBy, sortOrder },
            })),

          // Enhanced actions - Session State
          updateSessionState: (sessionState) =>
            set((state) => ({
              sessionState: { ...state.sessionState, ...sessionState },
            })),
          setCurrentRoute: (route) =>
            set((state) => ({
              sessionState: {
                ...state.sessionState,
                lastRoute: route,
                lastActivity: Date.now(),
              },
            })),
          setCurrentWorkspace: (workspace) =>
            set((state) => ({
              sessionState: {
                ...state.sessionState,
                currentWorkspace: workspace,
              },
            })),
          addOpenTab: (tab) =>
            set((state) => {
              const openTabs = [...state.sessionState.openTabs]
              if (!openTabs.includes(tab)) {
                openTabs.push(tab)
                // Keep only last 10 tabs
                if (openTabs.length > 10) {
                  openTabs.shift()
                }
              }
              return {
                sessionState: { ...state.sessionState, openTabs },
              }
            }),
          removeOpenTab: (tab) =>
            set((state) => ({
              sessionState: {
                ...state.sessionState,
                openTabs: state.sessionState.openTabs.filter((t) => t !== tab),
              },
            })),
          addRecentItem: (item) =>
            set((state) => {
              const recentItems = [
                item,
                ...state.sessionState.recentItems.filter((i) => i !== item),
              ]
              // Keep only last 20 items
              if (recentItems.length > 20) {
                recentItems.splice(20)
              }
              return {
                sessionState: { ...state.sessionState, recentItems },
              }
            }),
          addSearchHistory: (query) =>
            set((state) => {
              const searchHistory = [
                query,
                ...state.sessionState.searchHistory.filter((q) => q !== query),
              ]
              // Keep only last 50 searches
              if (searchHistory.length > 50) {
                searchHistory.splice(50)
              }
              return {
                sessionState: { ...state.sessionState, searchHistory },
              }
            }),
          updateLastActivity: () =>
            set((state) => ({
              sessionState: { ...state.sessionState, lastActivity: Date.now() },
            })),

          // Enhanced actions - Offline Queue
          queueOfflineAction: (type, payload) =>
            set((state) => ({
              offlineQueue: [
                ...state.offlineQueue,
                {
                  id: `${Date.now()}_${Math.random().toString(36).substring(2)}`,
                  type,
                  payload,
                  timestamp: Date.now(),
                  retryCount: 0,
                },
              ],
            })),
          removeOfflineAction: (id) =>
            set((state) => ({
              offlineQueue: state.offlineQueue.filter(
                (action) => action.id !== id,
              ),
            })),
          clearOfflineQueue: () => set({ offlineQueue: [] }),

          // Enhanced actions - Form Drafts
          saveDraft: (formId, data) =>
            set((state) => ({
              formDrafts: {
                ...state.formDrafts,
                [formId]: { data, timestamp: Date.now() },
              },
            })),
          getDraft: (formId) => {
            const draft = get().formDrafts[formId]
            return draft?.data || null
          },
          clearDraft: (formId) =>
            set((state) => {
              const { [formId]: _, ...rest } = state.formDrafts
              return { formDrafts: rest }
            }),
          clearAllDrafts: () => set({ formDrafts: {} }),

          // Enhanced actions - Usage Analytics
          trackFeatureUsage: (featureName) =>
            set((state) => ({
              usageStats: {
                ...state.usageStats,
                featureUsage: {
                  ...state.usageStats.featureUsage,
                  [featureName]:
                    (state.usageStats.featureUsage[featureName] || 0) + 1,
                },
              },
            })),
          incrementSessionCount: () =>
            set((state) => ({
              usageStats: {
                ...state.usageStats,
                sessionCount: state.usageStats.sessionCount + 1,
              },
            })),
          recordSessionEnd: () =>
            set((state) => {
              const now = Date.now()
              const sessionDuration = state.usageStats.lastSessionEnd
                ? now - state.usageStats.lastSessionEnd
                : 0

              return {
                usageStats: {
                  ...state.usageStats,
                  lastSessionEnd: now,
                  totalTimeSpent:
                    state.usageStats.totalTimeSpent + sessionDuration,
                },
              }
            }),
          updatePerformanceMetric: (metric, value) =>
            set((state) => ({
              usageStats: {
                ...state.usageStats,
                performanceMetrics: {
                  ...state.usageStats.performanceMetrics,
                  [metric]: value,
                },
              },
            })),
        }),
        {
          name: 'therapy-state-enhanced',
          partialize: (state) => ({
            // Security settings (persisted)
            securityLevel: state.securityLevel,
            encryptionEnabled: state.encryptionEnabled,
            mentalHealthAnalysisEnabled: state.mentalHealthAnalysisEnabled,
            expertGuidanceEnabled: state.expertGuidanceEnabled,

            // User preferences (persisted)
            preferences: state.preferences,

            // UI state (persisted)
            uiState: state.uiState,

            // Session state (persisted but with cleanup)
            sessionState: {
              ...state.sessionState,
              lastActivity: Date.now(), // Update on save
            },

            // Form drafts (persisted)
            formDrafts: state.formDrafts,

            // Usage stats (persisted)
            usageStats: state.usageStats,
          }),
          version: 2,
          migrate: (persistedState: unknown, version: number) => {
            // Handle migration from previous versions
            if (version < 2) {
              logger.info('Migrating store state to version 2')
              return {
                ...(persistedState as Record<string, unknown>),
                preferences: defaultPreferences,
                uiState: defaultUIState,
                sessionState: defaultSessionState,
                formDrafts: {},
                usageStats: defaultUsageStats,
              }
            }
            return persistedState
          },
        },
      ),
    ),
  ),
)

// ============================================================================
// Store Subscriptions and Side Effects
// ============================================================================

// Subscribe to theme changes to update document class
useStore.subscribe(
  (state) => state.preferences.theme,
  (theme) => {
    if (typeof window !== 'undefined') {
      const root = document.documentElement
      root.classList.remove('light', 'dark')

      if (theme === 'system') {
        const prefersDark = window.matchMedia(
          '(prefers-color-scheme: dark)',
        ).matches
        root.classList.add(prefersDark ? 'dark' : 'light')
      } else {
        root.classList.add(theme)
      }
    }
  },
)

// Subscribe to accessibility changes
useStore.subscribe(
  (state) => state.preferences.accessibility,
  (accessibility) => {
    if (typeof window !== 'undefined') {
      const root = document.documentElement

      // Apply reduced motion
      if (accessibility.reducedMotion) {
        root.style.setProperty('--motion-reduce', '1')
      } else {
        root.style.removeProperty('--motion-reduce')
      }

      // Apply high contrast
      if (accessibility.highContrast) {
        root.classList.add('high-contrast')
      } else {
        root.classList.remove('high-contrast')
      }

      // Apply font size
      root.classList.remove('font-small', 'font-medium', 'font-large')
      root.classList.add(`font-${accessibility.fontSize}`)
    }
  },
)

// Initialize session on store creation
if (typeof window !== 'undefined') {
  // Increment session count on page load
  useStore.getState().incrementSessionCount()

  // Record session end on page unload
  window.addEventListener('beforeunload', () => {
    useStore.getState().recordSessionEnd()
    useStore.getState().updateLastActivity()
  })

  // Update activity on user interaction
  const updateActivity = () => useStore.getState().updateLastActivity()
  window.addEventListener('mousedown', updateActivity)
  window.addEventListener('keydown', updateActivity)
  window.addEventListener('scroll', updateActivity)
  window.addEventListener('touchstart', updateActivity)
}
