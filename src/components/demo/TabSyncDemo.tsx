import type { FC } from 'react'
import React from 'react'
import { useSyncedState, useSyncedObject } from '@/hooks/useSyncedState'
import { OfflineIndicator } from '@/components/layout/OfflineIndicator'
import { FadeIn } from '@/components/layout/AdvancedAnimations'
import {
  ResponsiveContainer,
  ResponsiveText,
} from '@/components/layout/ResponsiveUtils'
import tabSyncManager from '@/utils/sync/tabSyncManager'

// interface SyncedCounter {
//   value: number
//   lastUpdated: number
//   updatedBy: string
// }

interface SyncedPreferences {
  theme: 'light' | 'dark'
  fontSize: 'small' | 'medium' | 'large'
  notifications: boolean
  language: string
}

/**
 * Demonstration component showing real-time tab synchronization
 */
export const TabSyncDemo: FC = () => {
  // Synced counter state
  const [counter, setCounter, counterLoaded, counterSyncStatus] =
    useSyncedState<number>({
      key: 'demo_synced_counter',
      defaultValue: 0,
      enableSync: true,
      debounceMs: 500,
      onSync: (value, tabId) => {
        console.log(`Counter synced from tab ${tabId}:`, value)
      },
    })

  // Synced preferences object
  const [
    preferences,
    setPreferences,
    updatePreference,
    ,
    prefsLoaded,
    prefsSyncStatus,
  ] = useSyncedObject<SyncedPreferences>({
    key: 'demo_synced_preferences',
    defaultValue: {
      theme: 'light',
      fontSize: 'medium',
      notifications: true,
      language: 'en',
    },
    enableSync: true,
    debounceMs: 300,
    conflictStrategy: 'merge',
    onSync: (value, tabId) => {
      console.log(`Preferences synced from tab ${tabId}:`, value)
    },
  })

  // Tab sync statistics
  const [syncStats, setSyncStats] = React.useState(() =>
    tabSyncManager.getStats(),
  )
  const [activeTabs, setActiveTabs] = React.useState<string[]>([])

  // Update sync statistics periodically
  React.useEffect(() => {
    const updateStats = () => {
      setSyncStats(tabSyncManager.getStats())
    }

    const interval = setInterval(updateStats, 2000)
    updateStats()

    return () => clearInterval(interval)
  }, [])

  // Track active tabs
  React.useEffect(() => {
    const handleTabJoin = (data: any) => {
      setActiveTabs((prev) => {
        if (!prev.includes(data.tabId)) {
          return [...prev, data.tabId]
        }
        return prev
      })
    }

    const handleTabLeave = (data: any) => {
      setActiveTabs((prev) => prev.filter((id) => id !== data.tabId))
    }

    tabSyncManager.on('tabJoined', handleTabJoin)
    tabSyncManager.on('tabLeft', handleTabLeave)

    return () => {
      tabSyncManager.on('tabJoined', handleTabJoin)
      tabSyncManager.on('tabLeft', handleTabLeave)
    }
  }, [])

  const incrementCounter = () => setCounter((prev) => prev + 1)
  const decrementCounter = () => setCounter((prev) => prev - 1)

  const resetCounter = () => setCounter(0)

  const resetPreferences = () => {
    setPreferences({
      theme: 'light',
      fontSize: 'medium',
      notifications: true,
      language: 'en',
    })
  }

  const isLoaded = counterLoaded && prefsLoaded
  const currentTabId = tabSyncManager.getTabId()

  return (
    <ResponsiveContainer size="lg">
      <div className="space-y-8 p-8">
        <ResponsiveText size="xl" className="text-center mb-8">
          Real-Time Tab Synchronization Demo
        </ResponsiveText>

        {/* Offline Indicator */}
        <OfflineIndicator showDetails position="top-right" />

        {/* Sync Status */}
        <FadeIn>
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold mb-4">
              Synchronization Status
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-3 h-3 rounded-full ${tabSyncManager.isAvailable() ? 'bg-green-500' : 'bg-red-500'}`}
                  />
                  <span className="font-medium">Tab Sync</span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {tabSyncManager.isAvailable() ? 'Active' : 'Not Available'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Tab ID: {currentTabId}
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="font-medium mb-2">Active Tabs</div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {activeTabs.length + 1}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Currently open
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="font-medium mb-2">Tracked Keys</div>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {syncStats.trackedKeys}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Synced values
                </div>
              </div>
            </div>
          </section>
        </FadeIn>

        {isLoaded && (
          <>
            {/* Synced Counter Demo */}
            <FadeIn>
              <section className="space-y-6">
                <h2 className="text-2xl font-semibold mb-4">Synced Counter</h2>

                <div className="max-w-md mx-auto space-y-4">
                  <div className="text-center">
                    <div className="text-6xl font-bold text-blue-600 dark:text-blue-400 mb-4">
                      {counter}
                    </div>
                    <div className="text-sm text-gray-500 mb-4">
                      Sync Status:{' '}
                      <span
                        className={`font-medium ${
                          counterSyncStatus === 'synced'
                            ? 'text-green-600'
                            : counterSyncStatus === 'syncing'
                              ? 'text-yellow-600'
                              : counterSyncStatus === 'conflict'
                                ? 'text-red-600'
                                : 'text-gray-600'
                        }`}
                      >
                        {counterSyncStatus}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={decrementCounter}
                      className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium"
                    >
                      -1
                    </button>
                    <button
                      onClick={incrementCounter}
                      className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-medium"
                    >
                      +1
                    </button>
                    <button
                      onClick={resetCounter}
                      className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                    >
                      Reset
                    </button>
                  </div>

                  <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                    Changes sync across all open tabs in real-time
                  </div>
                </div>
              </section>
            </FadeIn>

            {/* Synced Preferences Demo */}
            <FadeIn>
              <section className="space-y-6">
                <h2 className="text-2xl font-semibold mb-4">
                  Synced Preferences
                </h2>

                <div className="max-w-2xl mx-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <h3 className="text-lg font-medium mb-4">Settings</h3>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Theme
                          </label>
                          <select
                            value={preferences.theme}
                            onChange={(e) =>
                              updatePreference(
                                'theme',
                                e.target.value as 'light' | 'dark',
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                          >
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Font Size
                          </label>
                          <select
                            value={preferences.fontSize}
                            onChange={(e) =>
                              updatePreference(
                                'fontSize',
                                e.target.value as 'small' | 'medium' | 'large',
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                          >
                            <option value="small">Small</option>
                            <option value="medium">Medium</option>
                            <option value="large">Large</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Language
                          </label>
                          <select
                            value={preferences.language}
                            onChange={(e) =>
                              updatePreference('language', e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                          >
                            <option value="en">English</option>
                            <option value="es">Spanish</option>
                            <option value="fr">French</option>
                            <option value="de">German</option>
                          </select>
                        </div>

                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">
                            Notifications
                          </label>
                          <button
                            onClick={() =>
                              updatePreference(
                                'notifications',
                                !preferences.notifications,
                              )
                            }
                            className={`relative w-12 h-6 rounded-full transition-colors ${
                              preferences.notifications
                                ? 'bg-green-500'
                                : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                          >
                            <div
                              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                                preferences.notifications ? 'left-7' : 'left-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <h3 className="text-lg font-medium mb-4">Live Preview</h3>

                      <div className="space-y-3">
                        <div className="text-sm">
                          <span className="font-medium">Theme:</span>{' '}
                          {preferences.theme}
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">Font Size:</span>{' '}
                          {preferences.fontSize}
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">Language:</span>{' '}
                          {preferences.language}
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">Notifications:</span>{' '}
                          {preferences.notifications ? 'On' : 'Off'}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="text-xs text-gray-500 mb-2">
                          Sync Status:
                        </div>
                        <div
                          className={`text-sm font-medium ${
                            prefsSyncStatus === 'synced'
                              ? 'text-green-600'
                              : prefsSyncStatus === 'syncing'
                                ? 'text-yellow-600'
                                : prefsSyncStatus === 'conflict'
                                  ? 'text-red-600'
                                  : 'text-gray-600'
                          }`}
                        >
                          {prefsSyncStatus}
                        </div>
                      </div>

                      <button
                        onClick={resetPreferences}
                        className="w-full px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                      >
                        Reset to Defaults
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </FadeIn>

            {/* Tab Activity */}
            <FadeIn>
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mb-4">Tab Activity</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
                      How It Works
                    </h3>
                    <ul className="text-sm text-blue-700 dark:text-blue-200 space-y-2">
                      <li>• Open this page in multiple tabs/windows</li>
                      <li>• Changes in one tab instantly sync to others</li>
                      <li>• Each tab has a unique ID for tracking</li>
                      <li>• Conflicts are resolved automatically</li>
                      <li>• State persists across browser sessions</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <h3 className="font-medium text-green-900 dark:text-green-100 mb-3">
                      Features
                    </h3>
                    <ul className="text-sm text-green-700 dark:text-green-200 space-y-2">
                      <li>• Real-time cross-tab synchronization</li>
                      <li>• Automatic conflict resolution</li>
                      <li>• Persistent storage integration</li>
                      <li>• Version control and checksums</li>
                      <li>• Efficient debounced updates</li>
                    </ul>
                  </div>
                </div>
              </section>
            </FadeIn>

            {/* Instructions */}
            <FadeIn>
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mb-4">
                  Testing Instructions
                </h2>

                <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <h3 className="font-medium text-yellow-900 dark:text-yellow-100 mb-3">
                    To test synchronization:
                  </h3>
                  <ol className="text-sm text-yellow-700 dark:text-yellow-200 space-y-2 list-decimal list-inside">
                    <li>
                      Open this page in a new tab (right-click → Open in new
                      tab)
                    </li>
                    <li>Make changes in one tab (counter or preferences)</li>
                    <li>Watch the changes appear instantly in the other tab</li>
                    <li>
                      Try making conflicting changes to see resolution in action
                    </li>
                    <li>Refresh tabs to see persistence across reloads</li>
                  </ol>
                </div>
              </section>
            </FadeIn>
          </>
        )}
      </div>
    </ResponsiveContainer>
  )
}

export default TabSyncDemo
