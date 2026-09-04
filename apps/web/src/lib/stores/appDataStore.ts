import { create } from 'zustand'
import { devtools, subscribeWithSelector, persist } from 'zustand/middleware'

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

interface UsageStats {
  sessionCount: number
  totalTimeSpent: number
  featureUsage: Record<string, number>
  lastSessionEnd: number | null
  performanceMetrics: { averageLoadTime: number; errorCount: number; crashCount: number }
}

interface AppDataState {
  sessionState: SessionState
  offlineQueue: OfflineAction[]
  formDrafts: Record<string, { data: unknown; timestamp: number }>
  usageStats: UsageStats

  updateSessionState: (sessionState: Partial<SessionState>) => void
  setCurrentRoute: (route: string) => void
  setCurrentWorkspace: (workspace: string | null) => void
  addOpenTab: (tab: string) => void
  removeOpenTab: (tab: string) => void
  addRecentItem: (item: string) => void
  addSearchHistory: (query: string) => void
  updateLastActivity: () => void

  queueOfflineAction: (type: string, payload: unknown) => void
  removeOfflineAction: (id: string) => void
  clearOfflineQueue: () => void

  saveDraft: (formId: string, data: unknown) => void
  getDraft: (formId: string) => unknown
  clearDraft: (formId: string) => void
  clearAllDrafts: () => void

  trackFeatureUsage: (featureName: string) => void
  incrementSessionCount: () => void
  recordSessionEnd: () => void
  updatePerformanceMetric: (metric: keyof UsageStats['performanceMetrics'], value: number) => void
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
  performanceMetrics: { averageLoadTime: 0, errorCount: 0, crashCount: 0 },
}

export const useAppDataStore = create<AppDataState>()(
  devtools(
    subscribeWithSelector(
      persist(
        (set, get): AppDataState => ({
          sessionState: defaultSessionState,
          offlineQueue: [],
          formDrafts: {},
          usageStats: defaultUsageStats,

          updateSessionState: (ss) => set((state) => ({ sessionState: { ...state.sessionState, ...ss } })),
          setCurrentRoute: (route) => set((state) => ({ sessionState: { ...state.sessionState, lastRoute: route, lastActivity: Date.now() } })),
          setCurrentWorkspace: (workspace) => set((state) => ({ sessionState: { ...state.sessionState, currentWorkspace: workspace } })),
          addOpenTab: (tab) => set((state) => {
            const openTabs = [...state.sessionState.openTabs]
            if (!openTabs.includes(tab)) { openTabs.push(tab); if (openTabs.length > 10) openTabs.shift() }
            return { sessionState: { ...state.sessionState, openTabs } }
          }),
          removeOpenTab: (tab) => set((state) => ({ sessionState: { ...state.sessionState, openTabs: state.sessionState.openTabs.filter((t) => t !== tab) } })),
          addRecentItem: (item) => set((state) => {
            const recentItems = [item, ...state.sessionState.recentItems.filter((i) => i !== item)]
            if (recentItems.length > 20) recentItems.splice(20)
            return { sessionState: { ...state.sessionState, recentItems } }
          }),
          addSearchHistory: (query) => set((state) => {
            const searchHistory = [query, ...state.sessionState.searchHistory.filter((q) => q !== query)]
            if (searchHistory.length > 50) searchHistory.splice(50)
            return { sessionState: { ...state.sessionState, searchHistory } }
          }),
          updateLastActivity: () => set((state) => ({ sessionState: { ...state.sessionState, lastActivity: Date.now() } })),

          queueOfflineAction: (type, payload) => set((state) => ({
            offlineQueue: [...state.offlineQueue, { id: `${Date.now()}_${Math.random().toString(36).substring(2)}`, type, payload, timestamp: Date.now(), retryCount: 0 }],
          })),
          removeOfflineAction: (id) => set((state) => ({ offlineQueue: state.offlineQueue.filter((a) => a.id !== id) })),
          clearOfflineQueue: () => set({ offlineQueue: [] }),

          saveDraft: (formId, data) => set((state) => ({ formDrafts: { ...state.formDrafts, [formId]: { data, timestamp: Date.now() } } })),
          getDraft: (formId) => { const draft = get().formDrafts[formId]; return draft?.data ?? null },
          clearDraft: (formId) => set((state) => { const { [formId]: _, ...rest } = state.formDrafts; return { formDrafts: rest } }),
          clearAllDrafts: () => set({ formDrafts: {} }),

          trackFeatureUsage: (featureName) => set((state) => ({
            usageStats: { ...state.usageStats, featureUsage: { ...state.usageStats.featureUsage, [featureName]: (state.usageStats.featureUsage[featureName] ?? 0) + 1 } },
          })),
          incrementSessionCount: () => set((state) => ({ usageStats: { ...state.usageStats, sessionCount: state.usageStats.sessionCount + 1 } })),
          recordSessionEnd: () => set((state) => {
            const now = Date.now()
            const sessionDuration = state.usageStats.lastSessionEnd ? now - state.usageStats.lastSessionEnd : 0
            return { usageStats: { ...state.usageStats, lastSessionEnd: now, totalTimeSpent: state.usageStats.totalTimeSpent + sessionDuration } }
          }),
          updatePerformanceMetric: (metric, value) => set((state) => ({
            usageStats: { ...state.usageStats, performanceMetrics: { ...state.usageStats.performanceMetrics, [metric]: value } },
          })),
        }),
        {
          name: 'therapy-state-appdata',
          partialize: (state) => ({
            sessionState: { ...state.sessionState, lastActivity: Date.now() },
            formDrafts: state.formDrafts,
            usageStats: state.usageStats,
          }),
        },
      ),
    ),
  ),
)
