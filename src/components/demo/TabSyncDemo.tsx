import type { FC } from 'react'
import React from 'react'

import { FadeIn } from '@/components/layout/AdvancedAnimations'
import { OfflineIndicator } from '@/components/layout/OfflineIndicator'
import {
  ResponsiveContainer,
  ResponsiveText,
} from '@/components/layout/ResponsiveUtils'
import { useSyncedState, useSyncedObject } from '@/hooks/useSyncedState'
import tabSyncManager from '@/utils/sync/tabSyncManager'

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
    const handleTabJoin = (data: { tabId: string }) => {
      setActiveTabs((prev) => {
        if (!prev.includes(data.tabId)) {
          return [...prev, data.tabId]
        }
        return prev
      })
    }

    const handleTabLeave = (data: { tabId: string }) => {
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
    <ResponsiveContainer size='lg'>
      <div className='space-y-8 p-8'>
        <ResponsiveText size='xl' className='mb-8 text-center'>
          Real-Time Tab Synchronization Demo
        </ResponsiveText>

        {/* Offline Indicator */}
        <OfflineIndicator showDetails position='top-right' />

        {/* Sync Status */}
        <FadeIn>
          <section className='space-y-4'>
            <h2 className='mb-4 text-2xl font-semibold'>
              Synchronization Status
            </h2>

            <div className='grid grid-cols-1 gap-6 md:grid-cols-3'>
              <div className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4'>
                <div className='mb-2 flex items-center gap-2'>
                  <div
                    className={`h-3 w-3 rounded-full ${tabSyncManager.isAvailable() ? 'bg-green-500' : 'bg-red-500'}`}
                  />
                  <span className='font-medium'>Tab Sync</span>
                </div>
                <div className='text-gray-600 dark:text-gray-400 text-sm'>
                  {tabSyncManager.isAvailable() ? 'Active' : 'Not Available'}
                </div>
                <div className='text-gray-500 mt-1 text-xs'>
                  Tab ID: {currentTabId}
                </div>
              </div>

              <div className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4'>
                <div className='mb-2 font-medium'>Active Tabs</div>
                <div className='text-blue-600 dark:text-blue-400 text-2xl font-bold'>
                  {activeTabs.length + 1}
                </div>
                <div className='text-gray-600 dark:text-gray-400 text-sm'>
                  Currently open
                </div>
              </div>

              <div className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4'>
                <div className='mb-2 font-medium'>Tracked Keys</div>
                <div className='text-purple-600 dark:text-purple-400 text-2xl font-bold'>
                  {syncStats.trackedKeys}
                </div>
                <div className='text-gray-600 dark:text-gray-400 text-sm'>
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
              <section className='space-y-6'>
                <h2 className='mb-4 text-2xl font-semibold'>Synced Counter</h2>

                <div className='mx-auto max-w-md space-y-4'>
                  <div className='text-center'>
                    <div className='text-blue-600 dark:text-blue-400 mb-4 text-6xl font-bold'>
                      {counter}
                    </div>
                    <div className='text-gray-500 mb-4 text-sm'>
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

                  <div className='flex justify-center gap-3'>
                    <button
                      onClick={decrementCounter}
                      className='bg-red-500 hover:bg-red-600 text-white rounded-lg px-6 py-3 font-medium transition-colors'
                    >
                      -1
                    </button>
                    <button
                      onClick={incrementCounter}
                      className='bg-green-500 hover:bg-green-600 text-white rounded-lg px-6 py-3 font-medium transition-colors'
                    >
                      +1
                    </button>
                    <button
                      onClick={resetCounter}
                      className='bg-gray-500 hover:bg-gray-600 text-white rounded-lg px-6 py-3 font-medium transition-colors'
                    >
                      Reset
                    </button>
                  </div>

                  <div className='text-gray-600 dark:text-gray-400 text-center text-sm'>
                    Changes sync across all open tabs in real-time
                  </div>
                </div>
              </section>
            </FadeIn>

            {/* Synced Preferences Demo */}
            <FadeIn>
              <section className='space-y-6'>
                <h2 className='mb-4 text-2xl font-semibold'>
                  Synced Preferences
                </h2>

                <div className='mx-auto max-w-2xl'>
                  <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
                    <div className='bg-gray-50 dark:bg-gray-800 space-y-4 rounded-lg p-6'>
                      <h3 className='mb-4 text-lg font-medium'>Settings</h3>

                      <div className='space-y-4'>
                        <div>
                          <label
                            htmlFor='theme-select'
                            className='mb-2 block text-sm font-medium'
                          >
                            Theme
                          </label>
                          <select
                            id='theme-select'
                            value={preferences.theme}
                            onChange={(e) =>
                              updatePreference(
                                'theme',
                                e.target.value as 'light' | 'dark',
                              )
                            }
                            className='border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 w-full rounded-lg border px-3 py-2'
                          >
                            <option value='light'>Light</option>
                            <option value='dark'>Dark</option>
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor='font-size-select'
                            className='mb-2 block text-sm font-medium'
                          >
                            Font Size
                          </label>
                          <select
                            id='font-size-select'
                            value={preferences.fontSize}
                            onChange={(e) =>
                              updatePreference(
                                'fontSize',
                                e.target.value as 'small' | 'medium' | 'large',
                              )
                            }
                            className='border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 w-full rounded-lg border px-3 py-2'
                          >
                            <option value='small'>Small</option>
                            <option value='medium'>Medium</option>
                            <option value='large'>Large</option>
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor='language-select'
                            className='mb-2 block text-sm font-medium'
                          >
                            Language
                          </label>
                          <select
                            id='language-select'
                            value={preferences.language}
                            onChange={(e) =>
                              updatePreference('language', e.target.value)
                            }
                            className='border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 w-full rounded-lg border px-3 py-2'
                          >
                            <option value='en'>English</option>
                            <option value='es'>Spanish</option>
                            <option value='fr'>French</option>
                            <option value='de'>German</option>
                          </select>
                        </div>

                        <div className='flex items-center justify-between'>
                          <label
                            htmlFor='notifications-toggle'
                            className='text-sm font-medium'
                          >
                            Notifications
                          </label>
                          <button
                            id='notifications-toggle'
                            onClick={() =>
                              updatePreference(
                                'notifications',
                                !preferences.notifications,
                              )
                            }
                            aria-label='Toggle notifications'
                            className={`relative h-6 w-12 rounded-full transition-colors ${
                              preferences.notifications
                                ? 'bg-green-500'
                                : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                          >
                            <div
                              className={`bg-white absolute top-1 h-4 w-4 rounded-full transition-transform ${
                                preferences.notifications ? 'left-7' : 'left-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className='bg-gray-50 dark:bg-gray-800 space-y-4 rounded-lg p-6'>
                      <h3 className='mb-4 text-lg font-medium'>Live Preview</h3>

                      <div className='space-y-3'>
                        <div className='text-sm'>
                          <span className='font-medium'>Theme:</span>{' '}
                          {preferences.theme}
                        </div>
                        <div className='text-sm'>
                          <span className='font-medium'>Font Size:</span>{' '}
                          {preferences.fontSize}
                        </div>
                        <div className='text-sm'>
                          <span className='font-medium'>Language:</span>{' '}
                          {preferences.language}
                        </div>
                        <div className='text-sm'>
                          <span className='font-medium'>Notifications:</span>{' '}
                          {preferences.notifications ? 'On' : 'Off'}
                        </div>
                      </div>

                      <div className='border-gray-200 dark:border-gray-700 border-t pt-4'>
                        <div className='text-gray-500 mb-2 text-xs'>
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
                        className='bg-gray-500 hover:bg-gray-600 text-white w-full rounded-lg px-3 py-2 text-sm transition-colors'
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
              <section className='space-y-4'>
                <h2 className='mb-4 text-2xl font-semibold'>Tab Activity</h2>

                <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
                  <div className='bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 rounded-lg border p-4'>
                    <h3 className='text-blue-900 dark:text-blue-100 mb-3 font-medium'>
                      How It Works
                    </h3>
                    <ul className='text-blue-700 dark:text-blue-200 space-y-2 text-sm'>
                      <li>• Open this page in multiple tabs/windows</li>
                      <li>• Changes in one tab instantly sync to others</li>
                      <li>• Each tab has a unique ID for tracking</li>
                      <li>• Conflicts are resolved automatically</li>
                      <li>• State persists across browser sessions</li>
                    </ul>
                  </div>

                  <div className='bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 rounded-lg border p-4'>
                    <h3 className='text-green-900 dark:text-green-100 mb-3 font-medium'>
                      Features
                    </h3>
                    <ul className='text-green-700 dark:text-green-200 space-y-2 text-sm'>
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
              <section className='space-y-4'>
                <h2 className='mb-4 text-2xl font-semibold'>
                  Testing Instructions
                </h2>

                <div className='bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 rounded-lg border p-6'>
                  <h3 className='text-yellow-900 dark:text-yellow-100 mb-3 font-medium'>
                    To test synchronization:
                  </h3>
                  <ol className='text-yellow-700 dark:text-yellow-200 list-inside list-decimal space-y-2 text-sm'>
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
