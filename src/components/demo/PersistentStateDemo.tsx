import type { FC } from 'react'
import React from 'react'

import { FadeIn, SlideUp } from '@/components/layout/AdvancedAnimations'
import {
  ResponsiveContainer,
  ResponsiveText,
} from '@/components/layout/ResponsiveUtils'
import {
  usePersistentState,
  usePersistentObject,
  usePersistentArray,
  usePersistentMap,
} from '@/hooks/usePersistentState'

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
  const [preferences, setPreferences, updatePreference, , prefsLoaded] =
    usePersistentObject<DemoObject>({
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
  const [userScores, scoreActions, scoresLoaded] = usePersistentMap<
    string,
    number
  >({
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

  const isLoaded =
    counterLoaded && nameLoaded && prefsLoaded && todosLoaded && scoresLoaded

  return (
    <ResponsiveContainer size='lg'>
      <div className='space-y-8 p-8'>
        <ResponsiveText size='xl' className='mb-8 text-center'>
          Persistent State Management Demo
        </ResponsiveText>

        {!isLoaded && (
          <FadeIn>
            <div className='bg-blue-50 dark:bg-blue-900/20 rounded-lg p-8 text-center'>
              <div className='border-blue-500 border-t-transparent mb-4 inline-block h-6 w-6 animate-spin rounded-full border-2'></div>
              <p>Loading saved state...</p>
            </div>
          </FadeIn>
        )}

        {isLoaded && (
          <>
            {/* Basic State Examples */}
            <SlideUp>
              <section className='space-y-6'>
                <h2 className='mb-4 text-2xl font-semibold'>
                  Basic State Persistence
                </h2>

                <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
                  <div className='space-y-4'>
                    <h3 className='text-lg font-medium'>
                      Counter (with debouncing)
                    </h3>
                    <div className='bg-gray-50 dark:bg-gray-800 flex items-center gap-4 rounded-lg p-4'>
                      <button
                        onClick={() => setCounter((prev) => prev - 1)}
                        className='bg-red-500 text-white hover:bg-red-600 h-10 w-10 rounded-lg transition-colors'
                      >
                        -
                      </button>
                      <span className='min-w-[3rem] text-center font-mono text-2xl'>
                        {counter}
                      </span>
                      <button
                        onClick={() => setCounter((prev) => prev + 1)}
                        className='bg-green-500 text-white hover:bg-green-600 h-10 w-10 rounded-lg transition-colors'
                      >
                        +
                      </button>
                    </div>
                    <p className='text-gray-600 dark:text-gray-400 text-sm'>
                      Counter value persists across browser sessions with 500ms
                      debouncing
                    </p>
                  </div>

                  <div className='space-y-4'>
                    <h3 className='text-lg font-medium'>
                      Username (cross-tab sync)
                    </h3>
                    <input
                      type='text'
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder='Enter your name'
                      className='border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white w-full rounded-lg border px-3 py-2'
                    />
                    <p className='text-gray-600 dark:text-gray-400 text-sm'>
                      Username syncs across browser tabs in real-time
                    </p>
                  </div>
                </div>
              </section>
            </SlideUp>

            {/* Object State Example */}
            <SlideUp>
              <section className='space-y-6'>
                <h2 className='mb-4 text-2xl font-semibold'>
                  Object State Persistence
                </h2>

                <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
                  <div className='space-y-4'>
                    <h3 className='text-lg font-medium'>User Preferences</h3>
                    <div className='bg-gray-50 dark:bg-gray-800 space-y-3 rounded-lg p-4'>
                      <div className='flex items-center justify-between'>
                        <label className='text-sm font-medium'>Theme</label>
                        <select
                          value={preferences.theme}
                          onChange={(e) =>
                            updatePreference(
                              'theme',
                              e.target.value as 'light' | 'dark',
                            )
                          }
                          className='border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded border px-2 py-1 text-sm'
                        >
                          <option value='light'>Light</option>
                          <option value='dark'>Dark</option>
                        </select>
                      </div>

                      <div className='flex items-center justify-between'>
                        <label className='text-sm font-medium'>Language</label>
                        <select
                          value={preferences.language}
                          onChange={(e) =>
                            updatePreference('language', e.target.value)
                          }
                          className='border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded border px-2 py-1 text-sm'
                        >
                          <option value='en'>English</option>
                          <option value='es'>Spanish</option>
                          <option value='fr'>French</option>
                        </select>
                      </div>

                      <div className='flex items-center justify-between'>
                        <label className='text-sm font-medium'>
                          Notifications
                        </label>
                        <button
                          onClick={() =>
                            updatePreference(
                              'notifications',
                              !preferences.notifications,
                            )
                          }
                          className={`h-6 w-12 rounded-full transition-colors ${
                            preferences.notifications
                              ? 'bg-green-500'
                              : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        >
                          <div
                            className={`bg-white h-5 w-5 rounded-full transition-transform ${
                              preferences.notifications
                                ? 'translate-x-6'
                                : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className='flex items-center justify-between'>
                        <label className='text-sm font-medium'>
                          Items per page
                        </label>
                        <input
                          type='number'
                          min='5'
                          max='50'
                          value={preferences.itemsPerPage}
                          onChange={(e) =>
                            updatePreference(
                              'itemsPerPage',
                              parseInt(e.target.value) || 10,
                            )
                          }
                          className='border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 w-16 rounded border px-2 py-1 text-sm'
                        />
                      </div>
                    </div>
                  </div>

                  <div className='space-y-4'>
                    <h3 className='text-lg font-medium'>Current Preferences</h3>
                    <pre className='bg-gray-100 dark:bg-gray-900 overflow-auto rounded-lg p-4 text-xs'>
                      {JSON.stringify(preferences, null, 2)}
                    </pre>
                  </div>
                </div>
              </section>
            </SlideUp>

            {/* Array State Example */}
            <SlideUp>
              <section className='space-y-6'>
                <h2 className='mb-4 text-2xl font-semibold'>
                  Array State Persistence
                </h2>

                <div className='space-y-4'>
                  <div className='flex gap-4'>
                    <button
                      onClick={addTodo}
                      className='bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 transition-colors'
                    >
                      Add Todo
                    </button>
                    <button
                      onClick={resetAll}
                      className='bg-red-500 hover:bg-red-600 text-white rounded-lg px-4 py-2 transition-colors'
                    >
                      Reset All
                    </button>
                  </div>

                  <div className='space-y-2'>
                    {todoItems.map((item, index) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${
                          item.completed
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <button
                          onClick={() => toggleTodo(index)}
                          className={`h-5 w-5 rounded border-2 transition-colors ${
                            item.completed
                              ? 'bg-green-500 border-green-500'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          {item.completed && (
                            <svg
                              className='text-white mx-auto h-4 w-4'
                              fill='currentColor'
                              viewBox='0 0 20 20'
                            >
                              <path
                                fillRule='evenodd'
                                d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                                clipRule='evenodd'
                              />
                            </svg>
                          )}
                        </button>
                        <span
                          className={`flex-1 ${item.completed ? 'text-gray-500 line-through' : ''}`}
                        >
                          {item.text}
                        </span>
                        <button
                          onClick={() => todoActions.removeAt(index)}
                          className='text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300'
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
              <section className='space-y-6'>
                <h2 className='mb-4 text-2xl font-semibold'>
                  Map State Persistence
                </h2>

                <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
                  <div className='space-y-4'>
                    <h3 className='text-lg font-medium'>Game Scores</h3>
                    <div className='space-y-3'>
                      {Array.from(userScores.entries()).map(
                        ([level, score]) => (
                          <div key={level} className='flex items-center gap-3'>
                            <label className='min-w-[60px] text-sm font-medium'>
                              {level}:
                            </label>
                            <input
                              type='number'
                              min='0'
                              max='1000'
                              value={score}
                              onChange={(e) =>
                                updateScore(
                                  level,
                                  parseInt(e.target.value) || 0,
                                )
                              }
                              className='border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 flex-1 rounded border px-3 py-2 text-sm'
                            />
                          </div>
                        ),
                      )}
                      <button
                        onClick={() =>
                          updateScore(`level${userScores.size + 1}`, 0)
                        }
                        className='bg-purple-500 hover:bg-purple-600 text-white w-full rounded-lg px-3 py-2 text-sm transition-colors'
                      >
                        Add Level
                      </button>
                    </div>
                  </div>

                  <div className='space-y-4'>
                    <h3 className='text-lg font-medium'>Scores Map</h3>
                    <pre className='bg-gray-100 dark:bg-gray-900 overflow-auto rounded-lg p-4 text-xs'>
                      {JSON.stringify(Object.fromEntries(userScores), null, 2)}
                    </pre>
                  </div>
                </div>
              </section>
            </SlideUp>

            {/* Storage Info */}
            <SlideUp>
              <section className='space-y-4'>
                <h2 className='mb-4 text-2xl font-semibold'>
                  Storage Information
                </h2>

                <div className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4'>
                  <div className='grid grid-cols-2 gap-4 text-sm md:grid-cols-4'>
                    <div>
                      <div className='text-gray-600 dark:text-gray-400 font-medium'>
                        Counter
                      </div>
                      <div className='font-mono'>{counter}</div>
                    </div>
                    <div>
                      <div className='text-gray-600 dark:text-gray-400 font-medium'>
                        Todos
                      </div>
                      <div className='font-mono'>{todoItems.length}</div>
                    </div>
                    <div>
                      <div className='text-gray-600 dark:text-gray-400 font-medium'>
                        Scores
                      </div>
                      <div className='font-mono'>{userScores.size}</div>
                    </div>
                    <div>
                      <div className='text-gray-600 dark:text-gray-400 font-medium'>
                        Theme
                      </div>
                      <div className='font-mono capitalize'>
                        {preferences.theme}
                      </div>
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
