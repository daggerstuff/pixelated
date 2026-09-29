import { useState, useMemo } from 'react'

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

  // ⚡ Bolt: Convert topics array to Set to prevent O(N^2) lookups inside rendering map loop
  const selectedTopicsSet = useMemo(
    () => new Set(localFilters.topics),
    [localFilters.topics],
  )

  return (
    <div className="rounded-none border border-border bg-secondary p-6 text-left">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-xl font-bold text-foreground">Advanced Filters</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <span className="sr-only">Close</span>✕
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Year Range */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            Year Range
          </label>
          <div className="flex items-center gap-4">
            <input
              type="number"
              min="1900"
              max="2026"
              placeholder="From"
              aria-label="Year From"
              className="w-full rounded border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-1 focus:ring-ring"
              value={localFilters.yearFrom ?? ''}
              onChange={(e) =>
                setLocalFilters({
                  ...localFilters,
                  yearFrom: e.target.value
                    ? parseInt(e.target.value)
                    : undefined,
                })
              }
            />
            <span className="text-muted-foreground">-</span>
            <input
              type="number"
              min="1900"
              max="2026"
              placeholder="To"
              aria-label="Year To"
              className="w-full rounded border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-1 focus:ring-ring"
              value={localFilters.yearTo ?? ''}
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
          <div className="mb-2 flex justify-between">
            <label
              htmlFor="min-relevance"
              className="block text-sm font-medium text-foreground"
            >
              Min Relevance Score
            </label>
            <span className="font-mono text-sm text-foreground">
              {localFilters.minRelevance.toFixed(1)}
            </span>
          </div>
          <input
            id="min-relevance"
            type="range"
            min="0"
            max="1"
            step="0.1"
            className="h-2 w-full cursor-pointer appearance-none rounded-none bg-secondary accent-primary"
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
          <label className="mb-3 block text-sm font-medium text-foreground">
            Therapeutic Topics
          </label>
          <div className="flex flex-wrap gap-2">
            {COMMON_TOPICS.map((topic) => {
              const isSelected = selectedTopicsSet.has(topic)
              return (
                <button
                  key={topic}
                  onClick={() => toggleTopic(topic)}
                  aria-pressed={isSelected}
                  className={`rounded-none border px-3 py-1 text-xs font-medium transition-colors ${
                    isSelected
                      ? 'border-ring bg-secondary font-semibold text-foreground'
                      : 'border-transparent bg-secondary text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {topic}
                </button>
              )
            })}
          </div>
        </div>

        {/* Sort By */}
        <div>
          <label
            htmlFor="sort-by"
            className="mb-2 block text-sm font-medium text-foreground"
          >
            Sort By
          </label>
          <select
            id="sort-by"
            className="w-full rounded border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-1 focus:ring-ring"
            value={localFilters.sortBy}
            onChange={(e) =>
              setLocalFilters({ ...localFilters, sortBy: e.target.value })
            }
          >
            <option value="relevance">Relevance (Default)</option>
            <option value="year_desc">Year (Newest)</option>
            <option value="year_asc">Year (Oldest)</option>
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-border pt-4">
          <button
            onClick={handleApply}
            className="flex-1 rounded bg-primary py-2 font-medium text-foreground transition-colors hover:bg-accent"
          >
            Apply Filters
          </button>
          <button
            onClick={handleReset}
            className="rounded border border-input px-4 py-2 text-foreground transition-colors hover:bg-secondary"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}
