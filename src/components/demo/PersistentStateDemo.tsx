import type { FC } from 'react'
import React from 'react'
import { usePersistentState, usePersistentObject, usePersistentArray, usePersistentMap } from '@/hooks/usePersistentState'
import { FadeIn, SlideUp } from '@/components/layout/AdvancedAnimations'
import { ResponsiveContainer, ResponsiveText } from '@/components/layout/ResponsiveUtils'

interface DemoObject {
  theme: 'light' | 'dark'
  language: string
  notifications: boolean
  itemsPerPage: number
}

interface DemoItem {
  id: string
  text: string
  completed: boolean
}

/**
 * Demonstration component showing persistent state capabilities
 */
export const PersistentStateDemo: FC = () => {
  // Basic persistent state
  const [counter, setCounter, counterLoaded] = usePersistentState({
    key: 'demo_counter',
    defaultValue: 0,
    debounceMs: 500,
  })

  const [userName, setUserName, nameLoaded] = usePersistentState({
    key: 'demo_username',
    defaultValue: '',
    syncAcrossTabs: true,
  })

  // Persistent object state
  const [preferences, setPreferences, updatePreference, removePreference, prefsLoaded] = usePersistentObject<DemoObject>({
    key: 'demo_preferences',
    defaultValue: {
      theme: 'light',
      language: 'en',
      notifications: true,
      itemsPerPage: 10,
    },
    debounceMs: 300,
  })

  // Persistent array state
  const [todoItems, todoActions, todosLoaded] = usePersistentArray<DemoItem>({
    key: 'demo_todos',
    defaultValue: [
      { id: '1', text: 'Learn React', completed: true },
      { id: '2', text: 'Build persistent storage', completed: false },
    ],
  })

  // Persistent map state
  const [userScores, scoreActions, scoresLoaded] = usePersistentMap<string, number>({
    key: 'demo_scores',
    defaultValue: new Map([
      ['level1', 100],
      ['level2', 85],
    ]),
  })

  const addTodo = () => {
    const newTodo: DemoItem = {
      id: Date.now().toString(),
      text: `New task ${todoItems.length + 1}`,
      completed: false,
    }
    todoActions.push(newTodo)
  }

  const toggleTodo = (index: number) => {
    const item = todoItems[index]
    if (item) {
      todoActions.updateAt(index, { ...item, completed: !item.completed })
    }
  }

  const updateScore = (level: string, score: number) => {
    scoreActions.set(level, score)
  }

  const resetAll = () => {
    setCounter(0)
    setUserName('')
    setPreferences({
      theme: 'light',
      language: 'en',
      notifications: true,
      itemsPerPage: 10,
    })
    todoActions.clear()
    scoreActions.clear()
  }

  const isLoaded = counterLoaded && nameLoaded && prefsLoaded && todosLoaded && scoresLoaded

  return (
    <ResponsiveContainer size="lg">
      <div className="space-y-8 p-8">
        <ResponsiveText size="xl" className="text-center mb-8">
          Persistent State Management Demo
        </ResponsiveText>

        {!isLoaded && (
          <FadeIn>
            <div className="text-center p-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mb-4"></div>
              <p>Loading saved state...</p>
            </div>
          </FadeIn>
        )}

        {isLoaded && (
          <>
            {/* Basic State Examples */}
            <SlideUp>
              <section className="space-y-6">
                <h2 className="text-2xl font-semibold mb-4">Basic State Persistence</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Counter (with debouncing)</h3>
                    <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <button
                        onClick={() => setCounter(prev => prev - 1)}
                        className="w-10 h-10 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      >
                        -
                      </button>
                      <span className="text-2xl font-mono min-w-[3rem] text-center">{counter}</span>
                      <button
                        onClick={() => setCounter(prev => prev + 1)}
                        className="w-10 h-10 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Counter value persists across browser sessions with 500ms debouncing
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Username (cross-tab sync)</h3>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Username syncs across browser tabs in real-time
                    </p>
                  </div>
                </div>
              </section>
            </SlideUp>

            {/* Object State Example */}
            <SlideUp>
              <section className="space-y-6">
                <h2 className="text-2xl font-semibold mb-4">Object State Persistence</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">User Preferences</h3>
                    <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Theme</label>
                        <select
                          value={preferences.theme}
                          onChange={(e) => updatePreference('theme', e.target.value as 'light' | 'dark')}
                          className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
                        >
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Language</label>
                        <select
                          value={preferences.language}
                          onChange={(e) => updatePreference('language', e.target.value)}
                          className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
                        >
                          <option value="en">English</option>
                          <option value="es">Spanish</option>
                          <option value="fr">French</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Notifications</label>
                        <button
                          onClick={() => updatePreference('notifications', !preferences.notifications)}
                          className={`w-12 h-6 rounded-full transition-colors ${
                            preferences.notifications ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        >
                          <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                            preferences.notifications ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Items per page</label>
                        <input
                          type="number"
                          min="5"
                          max="50"
                          value={preferences.itemsPerPage}
                          onChange={(e) => updatePreference('itemsPerPage', parseInt(e.target.value) || 10)}
                          className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Current Preferences</h3>
                    <pre className="p-4 bg-gray-100 dark:bg-gray-900 rounded-lg text-xs overflow-auto">
                      {JSON.stringify(preferences, null, 2)}
                    </pre>
                  </div>
                </div>
              </section>
            </SlideUp>

            {/* Array State Example */}
            <SlideUp>
              <section className="space-y-6">
                <h2 className="text-2xl font-semibold mb-4">Array State Persistence</h2>

                <div className="space-y-4">
                  <div className="flex gap-4">
                    <button
                      onClick={addTodo}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    >
                      Add Todo
                    </button>
                    <button
                      onClick={resetAll}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                    >
                      Reset All
                    </button>
                  </div>

                  <div className="space-y-2">
                    {todoItems.map((item, index) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-3 border rounded-lg transition-all ${
                          item.completed
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <button
                          onClick={() => toggleTodo(index)}
                          className={`w-5 h-5 rounded border-2 transition-colors ${
                            item.completed
                              ? 'bg-green-500 border-green-500'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          {item.completed && (
                            <svg className="w-4 h-4 text-white mx-auto" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                        <span className={`flex-1 ${item.completed ? 'line-through text-gray-500' : ''}`}>
                          {item.text}
                        </span>
                        <button
                          onClick={() => todoActions.removeAt(index)}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </SlideUp>

            {/* Map State Example */}
            <SlideUp>
              <section className="space-y-6">
                <h2 className="text-2xl font-semibold mb-4">Map State Persistence</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Game Scores</h3>
                    <div className="space-y-3">
                      {Array.from(userScores.entries()).map(([level, score]) => (
                        <div key={level} className="flex items-center gap-3">
                          <label className="text-sm font-medium min-w-[60px]">{level}:</label>
                          <input
                            type="number"
                            min="0"
                            max="1000"
                            value={score}
                            onChange={(e) => updateScore(level, parseInt(e.target.value) || 0)}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
                          />
                        </div>
                      ))}
                      <button
                        onClick={() => updateScore(`level${userScores.size + 1}`, 0)}
                        className="w-full px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors text-sm"
                      >
                        Add Level
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Scores Map</h3>
                    <pre className="p-4 bg-gray-100 dark:bg-gray-900 rounded-lg text-xs overflow-auto">
                      {JSON.stringify(Object.fromEntries(userScores), null, 2)}
                    </pre>
                  </div>
                </div>
              </section>
            </SlideUp>

            {/* Storage Info */}
            <SlideUp>
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mb-4">Storage Information</h2>

                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="font-medium text-gray-600 dark:text-gray-400">Counter</div>
                      <div className="font-mono">{counter}</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-600 dark:text-gray-400">Todos</div>
                      <div className="font-mono">{todoItems.length}</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-600 dark:text-gray-400">Scores</div>
                      <div className="font-mono">{userScores.size}</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-600 dark:text-gray-400">Theme</div>
                      <div className="font-mono capitalize">{preferences.theme}</div>
                    </div>
                  </div>
                </div>
              </section>
            </SlideUp>
          </>
        )}
      </div>
    </ResponsiveContainer>
  )
}

export default PersistentStateDemo