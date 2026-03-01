import React, { useState } from 'react'

export interface SearchFiltersState {
  yearFrom?: number
  yearTo?: number
  topics: string[]
  minRelevance: number
  publishers: string[]
  sortBy: string
}

interface SearchFiltersProps {
  filters: SearchFiltersState
  onChange: (filters: SearchFiltersState) => void
  onClose?: () => void
}

const COMMON_TOPICS = [
  'CBT',
  'DBT',
  'Trauma',
  'Anxiety',
  'Depression',
  'Mindfulness',
  'Neuroscience',
  'Psychopharmacology',
  'Child Psychology',
  'Family Therapy',
]

export default function SearchFilters({
  filters,
  onChange,
  onClose,
}: SearchFiltersProps) {
  const [localFilters, setLocalFilters] = useState<SearchFiltersState>(filters)

  const handleApply = () => {
    onChange(localFilters)
    if (onClose) onClose()
  }

  const handleReset = () => {
    const defaultFilters: SearchFiltersState = {
      topics: [],
      minRelevance: 0,
      publishers: [],
      sortBy: 'relevance',
    }
    setLocalFilters(defaultFilters)
    onChange(defaultFilters)
  }

  const toggleTopic = (topic: string) => {
    setLocalFilters((prev) => {
      const newTopics = prev.topics.includes(topic)
        ? prev.topics.filter((t) => t !== topic)
        : [...prev.topics, topic]
      return { ...prev, topics: newTopics }
    })
  }

  return (
    <div className='bg-slate-800 border-slate-700 rounded-lg border p-6 text-left shadow-xl'>
      <div className='mb-6 flex items-center justify-between'>
        <h3 className='text-white text-xl font-bold'>Advanced Filters</h3>
        {onClose && (
          <button onClick={onClose} className='text-slate-400 hover:text-white'>
            <span className='sr-only'>Close</span>✕
          </button>
        )}
      </div>

      <div className='space-y-6'>
        {/* Year Range */}
        <div>
          <label className='text-slate-300 mb-2 block text-sm font-medium'>
            Year Range
          </label>
          <div className='flex items-center gap-4'>
            <input
              type='number'
              min='1900'
              max='2026'
              placeholder='From'
              aria-label='Year From'
              className='bg-slate-900 border-slate-700 text-white focus:ring-pink-500 w-full rounded border px-3 py-2 outline-none focus:ring-1'
              value={localFilters.yearFrom || ''}
              onChange={(e) =>
                setLocalFilters({
                  ...localFilters,
                  yearFrom: e.target.value
                    ? parseInt(e.target.value)
                    : undefined,
                })
              }
            />
            <span className='text-slate-500'>-</span>
            <input
              type='number'
              min='1900'
              max='2026'
              placeholder='To'
              aria-label='Year To'
              className='bg-slate-900 border-slate-700 text-white focus:ring-pink-500 w-full rounded border px-3 py-2 outline-none focus:ring-1'
              value={localFilters.yearTo || ''}
              onChange={(e) =>
                setLocalFilters({
                  ...localFilters,
                  yearTo: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
            />
          </div>
        </div>

        {/* Relevance Threshold */}
        <div>
          <div className='mb-2 flex justify-between'>
            <label
              htmlFor='min-relevance'
              className='text-slate-300 block text-sm font-medium'
            >
              Min Relevance Score
            </label>
            <span className='text-pink-400 font-mono text-sm'>
              {localFilters.minRelevance.toFixed(1)}
            </span>
          </div>
          <input
            id='min-relevance'
            type='range'
            min='0'
            max='1'
            step='0.1'
            className='bg-slate-700 accent-pink-500 h-2 w-full cursor-pointer appearance-none rounded-lg'
            value={localFilters.minRelevance}
            onChange={(e) =>
              setLocalFilters({
                ...localFilters,
                minRelevance: parseFloat(e.target.value),
              })
            }
          />
        </div>

        {/* Topics */}
        <div>
          <label className='text-slate-300 mb-3 block text-sm font-medium'>
            Therapeutic Topics
          </label>
          <div className='flex flex-wrap gap-2'>
            {COMMON_TOPICS.map((topic) => (
              <button
                key={topic}
                onClick={() => toggleTopic(topic)}
                aria-pressed={localFilters.topics.includes(topic)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  localFilters.topics.includes(topic)
                    ? 'bg-pink-600/20 text-pink-300 border-pink-600'
                    : 'bg-slate-700/50 text-slate-400 border-transparent hover:bg-slate-700'
                }`}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>

        {/* Sort By */}
        <div>
          <label className='text-slate-300 mb-2 block text-sm font-medium'>
            Sort By
          </label>
          <select
            className='bg-slate-900 border-slate-700 text-white focus:ring-pink-500 w-full rounded border px-3 py-2 outline-none focus:ring-1'
            value={localFilters.sortBy}
            onChange={(e) =>
              setLocalFilters({ ...localFilters, sortBy: e.target.value })
            }
          >
            <option value='relevance'>Relevance (Default)</option>
            <option value='year_desc'>Year (Newest)</option>
            <option value='year_asc'>Year (Oldest)</option>
          </select>
        </div>

        {/* Actions */}
        <div className='border-slate-700 flex gap-3 border-t pt-4'>
          <button
            onClick={handleApply}
            className='bg-pink-600 hover:bg-pink-700 text-white flex-1 rounded py-2 font-medium transition-colors'
          >
            Apply Filters
          </button>
          <button
            onClick={handleReset}
            className='border-slate-600 text-slate-300 hover:bg-slate-700 rounded border px-4 py-2 transition-colors'
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}
