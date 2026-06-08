import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { persist, subscribeWithSelector } from 'zustand/middleware'

import type { AIService } from './ai/models/ai-types'
import { createMentalHealthChat } from './chat'
import type { FHEService } from './fhe'
import { logger } from './logger'

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
              set(
                (state) =>
                  ({
                    uiState: { ...state.uiState, sortBy, sortOrder },
                  }) as any,
              ),

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
            return draft?.data ?? null
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
                    (state.usageStats.featureUsage[featureName] ?? 0) + 1,
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
                  openTabs: state.sessionState.openTabs.filter(
                    (t) => t !== tab,
                  ),
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
                  ...state.sessionState.searchHistory.filter(
                    (q) => q !== query,
                  ),
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
                sessionState: {
                  ...state.sessionState,
                  lastActivity: Date.now(),
                },
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
              return draft?.data ?? null
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
                      (state.usageStats.featureUsage[featureName] ?? 0) + 1,
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
          }) as any,
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

