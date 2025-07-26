import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'

export interface FilterOptions {
  // Trend filters
  startDate?: Date | null
  endDate?: Date | null
  minSignificance?: number

  // Pattern filters
  patternType?: string
  minFrequency?: number

  // Risk filters
  minConfidence?: number
  riskFactor?: string
  minSeverity?: number
}

interface FilterControlsProps {
  options: FilterOptions
  onChange: (options: FilterOptions) => void
  onApply: () => void
  onReset: () => void
  activeTab: 'trends' | 'patterns' | 'risks'
  patternTypes?: string[]
  riskFactors?: string[]
}

export function FilterControls({
  options,
  onChange,
  onApply,
  onReset,
  activeTab,
  patternTypes = [],
  riskFactors = [],
}: FilterControlsProps) {
  const [dateError, setDateError] = useState<string | null>(null)

  const handleChange = (key: keyof FilterOptions, value: unknown) => {
    const newOptions = { ...options, [key]: value }
    if (
      (key === 'startDate' &&
        newOptions.endDate &&
        value &&
        value > newOptions.endDate) ||
      (key === 'endDate' &&
        newOptions.startDate &&
        value &&
        value < newOptions.startDate)
    ) {
      setDateError('End date cannot be earlier than start date.')
      return
    } else {
      setDateError(null)
    }
    onChange(newOptions)
  }

  return (
    <div className="filter-controls space-y-4 p-4 border rounded-md bg-gray-50 dark:bg-gray-900 mb-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-medium">Filter Options</h4>
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={onReset}>
            Reset
          </Button>
          <Button size="sm" onClick={onApply}>
            Apply Filters
          </Button>
        </div>
      </div>

      {activeTab === 'trends' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={
                options.startDate ? format(options.startDate, 'yyyy-MM-dd') : ''
              }
              onChange={(e) => {
                const date = e.target.value ? new Date(e.target.value) : null
                handleChange('startDate', date)
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={
                options.endDate ? format(options.endDate, 'yyyy-MM-dd') : ''
              }
              onChange={(e) => {
                const date = e.target.value ? new Date(e.target.value) : null
                handleChange('endDate', date)
              }}
            />
          </div>
        </div>
      )}

      {dateError && (
        <div className="text-red-500 text-xs mb-2">{dateError}</div>
      )}

      {activeTab === 'patterns' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="patternType">Pattern Type</Label>
            <Select
              value={options.patternType || ''}
              onValueChange={(value) => handleChange('patternType', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Types</SelectItem>
                {patternTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="minFrequency">Min Frequency</Label>
            <Input
              id="minFrequency"
              type="number"
              min={0}
              value={options.minFrequency || ''}
              onChange={(e) =>
                handleChange(
                  'minFrequency',
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              placeholder="Minimum frequency"
            />
          </div>
        </div>
      )}

      {activeTab === 'risks' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="minConfidence">Min Confidence</Label>
            <Input
              id="minConfidence"
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={options.minConfidence || ''}
              onChange={(e) =>
                handleChange(
                  'minConfidence',
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              placeholder="0.0 - 1.0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="riskFactor">Risk Factor</Label>
            <Select
              value={options.riskFactor || ''}
              onValueChange={(value) => handleChange('riskFactor', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Factors</SelectItem>
                {riskFactors.map((factor) => (
                  <SelectItem key={factor} value={factor}>
                    {factor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  )
}
