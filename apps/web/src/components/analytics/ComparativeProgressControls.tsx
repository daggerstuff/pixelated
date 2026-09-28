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
    <div className="flex flex-col justify-between gap-4 sm:flex-row">
      <div>
        <label
          htmlFor="metric-select"
          className="mb-1 block text-sm font-medium"
        >
          Metric
        </label>
        <select
          id="metric-select"
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          className="w-full rounded-none border border-input bg-background px-3 py-2 shadow-none focus:outline-none focus:ring-2 focus:ring-ring sm:w-auto"
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
          className="mb-1 block text-sm font-medium"
        >
          Comparison Group
        </label>
        <select
          id="cohort-select"
          value={cohort}
          onChange={(e) => setCohort(e.target.value)}
          className="w-full rounded-none border border-input bg-background px-3 py-2 shadow-none focus:outline-none focus:ring-2 focus:ring-ring sm:w-auto"
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
        <label htmlFor="date-range" className="mb-1 block text-sm font-medium">
          Time Period
        </label>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <input
              type="date"
              id="start-date"
              value={dateRange.startDate}
              onChange={handleStartDateChange}
              className={`w-full rounded-none border bg-background px-3 py-2 sm:w-auto ${dateError ? 'border-ring' : 'border-input'} focus:outline-none focus:ring-2 focus:ring-ring`}
              disabled={isLoading}
            />
            <span>to</span>
            <input
              type="date"
              id="end-date"
              value={dateRange.endDate}
              onChange={handleEndDateChange}
              className={`w-full rounded-none border bg-background px-3 py-2 sm:w-auto ${dateError ? 'border-ring' : 'border-input'} focus:outline-none focus:ring-2 focus:ring-ring`}
              disabled={isLoading}
            />
          </div>
          {dateError && (
            <div className="mt-1 text-xs font-medium text-foreground">
              {dateError}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
