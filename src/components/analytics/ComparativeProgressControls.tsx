import React, { useState } from 'react'

interface ComparativeProgressControlsProps {
  metric: string
  setMetric: (m: string) => void
  cohort: string
  setCohort: (c: string) => void
  dateRange: { startDate: string; endDate: string }
  setDateRange: (d: { startDate: string; endDate: string }) => void
  isLoading: boolean
  availableMetrics: { id: string; label: string }[]
  availableCohorts: { id: string; label: string }[]
}

export function ComparativeProgressControls({
  metric,
  setMetric,
  cohort,
  setCohort,
  dateRange,
  setDateRange,
  isLoading,
  availableMetrics,
  availableCohorts,
}: ComparativeProgressControlsProps) {
  const [dateError, setDateError] = useState<string | null>(null)

  const validateDateRange = (startDate: string, endDate: string): boolean => {
    if (!startDate || !endDate) {
      return true
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    return start <= end
  }

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartDate = e.target.value

    if (validateDateRange(newStartDate, dateRange.endDate)) {
      setDateRange({ ...dateRange, startDate: newStartDate })
      setDateError(null)
    } else {
      setDateError('Start date cannot be after end date')
    }
  }

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEndDate = e.target.value

    if (validateDateRange(dateRange.startDate, newEndDate)) {
      setDateRange({ ...dateRange, endDate: newEndDate })
      setDateError(null)
    } else {
      setDateError('End date cannot be before start date')
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-between">
      <div>
        <label
          htmlFor="metric-select"
          className="block text-sm font-medium mb-1"
        >
          Metric
        </label>
        <select
          id="metric-select"
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={isLoading}
        >
          {availableMetrics.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="cohort-select"
          className="block text-sm font-medium mb-1"
        >
          Comparison Group
        </label>
        <select
          id="cohort-select"
          value={cohort}
          onChange={(e) => setCohort(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={isLoading}
        >
          {availableCohorts.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="date-range" className="block text-sm font-medium mb-1">
          Time Period
        </label>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <input
              type="date"
              id="start-date"
              value={dateRange.startDate}
              onChange={handleStartDateChange}
              className={`w-full sm:w-auto px-3 py-2 bg-white dark:bg-gray-800 border ${dateError ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'} rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500`}
              disabled={isLoading}
            />
            <span>to</span>
            <input
              type="date"
              id="end-date"
              value={dateRange.endDate}
              onChange={handleEndDateChange}
              className={`w-full sm:w-auto px-3 py-2 bg-white dark:bg-gray-800 border ${dateError ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'} rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500`}
              disabled={isLoading}
            />
          </div>
          {dateError && (
            <div className="text-red-500 text-xs mt-1">{dateError}</div>
          )}
        </div>
      </div>
    </div>
  )
}
