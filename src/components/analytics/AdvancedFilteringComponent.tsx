/**
 * NOTE: If you see a TypeScript error about 'react/jsx-runtime' missing a declaration file,
 * this is a project-level configuration or dependency issue. Ensure your TypeScript version
 * and @types/react are up to date and compatible with your React version.
 */
import * as React from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import Popover, {
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { IconFilter, IconX } from '@/components/ui/icons'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

export interface AdvancedFilterOptions {
  // Time filters
  timeRange?: {
    startDate?: Date
    endDate?: Date
    presetRange?: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom'
  }

  // Emotion filters
  emotions?: {
    types?: string[]
    minIntensity?: number
    maxIntensity?: number
    dimensionalRanges?: {
      valence?: [number, number]
      arousal?: [number, number]
      dominance?: [number, number]
    }
  }

  // Pattern filters
  patterns?: {
    types?: string[]
    minStrength?: number
    minConfidence?: number
    categories?: string[]
  }

  // Visualization filters
  visualization?: {
    groupBy?: 'session' | 'day' | 'week' | 'month'
    smoothing?: number
    showRawData?: boolean
    showTrendlines?: boolean
    showConfidenceIntervals?: boolean
    showAnnotations?: boolean
  }

  // Additional metadata filters
  metadata?: Record<string, unknown>

  // Custom logic filter
  customLogic?: string

  // Keyword filter
  keywords?: string

  // Sentiment score filter
  sentimentScore?: {
    min?: number
    max?: number
  }
}

interface AdvancedFilteringComponentProps {
  options: AdvancedFilterOptions
  onChange: (options: AdvancedFilterOptions) => void
  onApply: () => void
  onReset?: () => void
  availableEmotionTypes?: string[]
  availablePatternTypes?: string[]
  availablePatternCategories?: string[]
  className?: string
  compact?: boolean
}

/**
 * Advanced filtering component for visualization systems
 *
 * Provides comprehensive filtering capabilities for emotion data, patterns,
 * time ranges, and visualization options.
 */
export function AdvancedFilteringComponent({
  options,
  onChange,
  onApply,
  onReset,
  availableEmotionTypes = [],
  availablePatternTypes = [],
  availablePatternCategories = [],
  className,
  compact = false,
}: AdvancedFilteringComponentProps) {
  const [activeTab, setActiveTab] = useState<
    'time' | 'emotions' | 'patterns' | 'visualization'
  >('time')

  // Handle changes to individual filter options
  const handleChange = <K extends keyof AdvancedFilterOptions>(
    category: K,
    key: string,
    value: unknown,
  ) => {
    onChange({
      ...options,
      [category]: {
        ...(options[category] as Record<string, unknown>),
        [key]: value,
      },
    })
  }

  // Handle nested changes (for dimensional ranges, etc.)
  const handleNestedChange = <K extends keyof AdvancedFilterOptions>(
    category: K,
    parentKey: string,
    key: string,
    value: unknown,
  ) => {
    onChange({
      ...options,
      [category]: {
        ...(options[category] as Record<string, unknown>),
        [parentKey]: {
          ...((options[category] as Record<string, unknown>)?.[
            parentKey
          ] as Record<string, unknown>),
          [key]: value,
        },
      },
    })
  }

  // Handle array-based filters (like emotion types)
  const handleArrayToggle = <K extends keyof AdvancedFilterOptions>(
    category: K,
    key: string,
    value: string,
  ) => {
    const currentArray =
      ((options[category] as Record<string, unknown>)?.[key] as string[]) || []
    const newArray = currentArray.includes(value)
      ? currentArray.filter((item) => item !== value)
      : [...currentArray, value]

    handleChange(category, key, newArray)
  }

  // Reset all filters
  const resetFilters = () => {
    onChange({})
    onReset?.()
  }

  // Apply filters
  const applyFilters = () => {
    onApply()
  }

  // Format the range values for display
  const formatRange = (range: [number, number] | undefined, precision = 1) => {
    if (!range) {
      return 'Any'
    }
    return `${range[0].toFixed(precision)} - ${range[1].toFixed(precision)}`
  }

  // Render different filter sections based on active tab
  const renderFilterSection = () => {
    switch (activeTab) {
      case 'time':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Time Range</Label>
              <Select
                value={options.timeRange?.presetRange || 'custom'}
                onValueChange={(value) =>
                  handleChange(
                    'timeRange',
                    'presetRange',
                    value as
                    | 'day'
                    | 'week'
                    | 'month'
                    | 'quarter'
                    | 'year'
                    | 'custom',
                  )
                }
                placeholder="Select time range"
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Last 24 hours</SelectItem>
                  <SelectItem value="week">Last 7 days</SelectItem>
                  <SelectItem value="month">Last 30 days</SelectItem>
                  <SelectItem value="quarter">Last 90 days</SelectItem>
                  <SelectItem value="year">Last 365 days</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {options.timeRange?.presetRange === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={
                      options.timeRange?.startDate
                        ? format(options.timeRange.startDate, 'yyyy-MM-dd')
                        : ''
                    }
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const date = e.target.value
                        ? new Date(e.target.value)
                        : undefined
                      handleChange('timeRange', 'startDate', date)
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={
                      options.timeRange?.endDate
                        ? format(options.timeRange.endDate, 'yyyy-MM-dd')
                        : ''
                    }
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const date = e.target.value
                        ? new Date(e.target.value)
                        : undefined
                      handleChange('timeRange', 'endDate', date)
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )

      case 'emotions':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Emotion Types</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                {availableEmotionTypes.map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={`emotion-${type}`}
                      checked={(options.emotions?.types || []).includes(type)}
                      onChange={() =>
                        handleArrayToggle('emotions', 'types', type)
                      }
                    />

                    <Label
                      htmlFor={`emotion-${type}`}
                      className="cursor-pointer"
                    >
                      {type}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Intensity Range</Label>
                <span className="text-xs text-gray-500">
                  {options.emotions?.minIntensity?.toFixed(1) || '0.0'} -{' '}
                  {options.emotions?.maxIntensity?.toFixed(1) || '1.0'}
                </span>
              </div>
              <div className="pt-2 px-2">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label className="text-xs">Min</Label>
                    <Slider
                      value={[options.emotions?.minIntensity || 0]}
                      min={0}
                      max={1}
                      step={0.1}
                      onValueChange={([min]: number[]) => {
                        handleChange('emotions', 'minIntensity', min)
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs">Max</Label>
                    <Slider
                      value={[options.emotions?.maxIntensity || 1]}
                      min={0}
                      max={1}
                      step={0.1}
                      onValueChange={([max]: number[]) => {
                        handleChange('emotions', 'maxIntensity', max)
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dimensional Ranges</Label>

              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm">
                      Valence (Negative to Positive)
                    </Label>
                    <span className="text-xs text-gray-500">
                      {formatRange(
                        options.emotions?.dimensionalRanges?.valence,
                      )}
                    </span>
                  </div>
                  <div className="pt-2 px-2">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Label className="text-xs">Min</Label>
                        <Slider
                          value={[
                            options.emotions?.dimensionalRanges?.valence
                              ? options.emotions.dimensionalRanges.valence[0]
                              : -1,
                          ]}
                          min={-1}
                          max={1}
                          step={0.1}
                          onValueChange={([min]: number[]) =>
                            handleNestedChange(
                              'emotions',
                              'dimensionalRanges',
                              'valence',
                              [
                                min,
                                options.emotions?.dimensionalRanges?.valence
                                  ? options.emotions.dimensionalRanges
                                    .valence[1]
                                  : 1,
                              ],
                            )
                          }
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Max</Label>
                        <Slider
                          value={[
                            options.emotions?.dimensionalRanges?.valence
                              ? options.emotions.dimensionalRanges.valence[1]
                              : 1,
                          ]}
                          min={-1}
                          max={1}
                          step={0.1}
                          onValueChange={([max]: number[]) =>
                            handleNestedChange(
                              'emotions',
                              'dimensionalRanges',
                              'valence',
                              [
                                options.emotions?.dimensionalRanges?.valence
                                  ? options.emotions.dimensionalRanges
                                    .valence[0]
                                  : -1,
                                max,
                              ],
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm">Arousal (Calm to Excited)</Label>
                    <span className="text-xs text-gray-500">
                      {formatRange(
                        options.emotions?.dimensionalRanges?.arousal,
                      )}
                    </span>
                  </div>
                  <div className="pt-2 px-2">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Label className="text-xs">Min</Label>
                        <Slider
                          value={[
                            options.emotions?.dimensionalRanges?.arousal
                              ? options.emotions.dimensionalRanges.arousal[0]
                              : -1,
                          ]}
                          min={-1}
                          max={1}
                          step={0.1}
                          onValueChange={([min]: number[]) =>
                            handleNestedChange(
                              'emotions',
                              'dimensionalRanges',
                              'arousal',
                              [
                                min,
                                options.emotions?.dimensionalRanges?.arousal
                                  ? options.emotions.dimensionalRanges
                                    .arousal[1]
                                  : 1,
                              ],
                            )
                          }
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Max</Label>
                        <Slider
                          value={[
                            options.emotions?.dimensionalRanges?.arousal
                              ? options.emotions.dimensionalRanges.arousal[1]
                              : 1,
                          ]}
                          min={-1}
                          max={1}
                          step={0.1}
                          onValueChange={([max]: number[]) =>
                            handleNestedChange(
                              'emotions',
                              'dimensionalRanges',
                              'arousal',
                              [
                                options.emotions?.dimensionalRanges?.arousal
                                  ? options.emotions.dimensionalRanges
                                    .arousal[0]
                                  : -1,
                                max,
                              ],
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm">
                      Dominance (Submissive to Dominant)
                    </Label>
                    <span className="text-xs text-gray-500">
                      {formatRange(
                        options.emotions?.dimensionalRanges?.dominance,
                      )}
                    </span>
                  </div>
                  <div className="pt-2 px-2">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Label className="text-xs">Min</Label>
                        <Slider
                          value={[
                            options.emotions?.dimensionalRanges?.dominance
                              ? options.emotions.dimensionalRanges.dominance[0]
                              : -1,
                          ]}
                          min={-1}
                          max={1}
                          step={0.1}
                          onValueChange={([min]: number[]) =>
                            handleNestedChange(
                              'emotions',
                              'dimensionalRanges',
                              'dominance',
                              [
                                min,
                                options.emotions?.dimensionalRanges?.dominance
                                  ? options.emotions.dimensionalRanges
                                    .dominance[1]
                                  : 1,
                              ],
                            )
                          }
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Max</Label>
                        <Slider
                          value={[
                            options.emotions?.dimensionalRanges?.dominance
                              ? options.emotions.dimensionalRanges.dominance[1]
                              : 1,
                          ]}
                          min={-1}
                          max={1}
                          step={0.1}
                          onValueChange={([max]: number[]) =>
                            handleNestedChange(
                              'emotions',
                              'dimensionalRanges',
                              'dominance',
                              [
                                options.emotions?.dimensionalRanges?.dominance
                                  ? options.emotions.dimensionalRanges
                                    .dominance[0]
                                  : -1,
                                max,
                              ],
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'patterns':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pattern Types</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                {availablePatternTypes.map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={`pattern-${type}`}
                      checked={(options.patterns?.types || []).includes(type)}
                      onChange={() =>
                        handleArrayToggle('patterns', 'types', type)
                      }
                    />

                    <Label
                      htmlFor={`pattern-${type}`}
                      className="cursor-pointer text-sm"
                    >
                      {type}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Minimum Pattern Strength</Label>
                <span className="text-xs text-gray-500">
                  {options.patterns?.minStrength?.toFixed(1) || '0.0'}
                </span>
              </div>
              <div className="pt-2 px-2">
                <Slider
                  value={[options.patterns?.minStrength || 0]}
                  min={0}
                  max={1}
                  step={0.1}
                  onValueChange={(value: number[]) =>
                    handleChange('patterns', 'minStrength', value[0])
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Minimum Confidence</Label>
                <span className="text-xs text-gray-500">
                  {options.patterns?.minConfidence?.toFixed(1) || '0.0'}
                </span>
              </div>
              <div className="pt-2 px-2">
                <Slider
                  value={[options.patterns?.minConfidence || 0]}
                  min={0}
                  max={1}
                  step={0.1}
                  onValueChange={(value: number[]) => {
                    handleChange('patterns', 'minConfidence', value[0])
                  }}
                />
              </div>
            </div>

            {availablePatternCategories.length > 0 && (
              <div className="space-y-2">
                <Label>Pattern Categories</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  {availablePatternCategories.map((category) => (
                    <div key={category} className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category}`}
                        checked={(options.patterns?.categories || []).includes(
                          category,
                        )}
                        onChange={() =>
                          handleArrayToggle('patterns', 'categories', category)
                        }
                      />

                      <Label
                        htmlFor={`category-${category}`}
                        className="cursor-pointer text-sm"
                      >
                        {category}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )

      case 'visualization':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Group By</Label>
              <Select
                value={options.visualization?.groupBy || 'session'}
                onValueChange={(value) =>
                  handleChange(
                    'visualization',
                    'groupBy',
                    value as 'day' | 'week' | 'month' | 'session',
                  )
                }
                placeholder="Select grouping"
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="session">Session</SelectItem>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Smoothing</Label>
                <span className="text-xs text-gray-500">
                  {options.visualization?.smoothing || 0}
                </span>
              </div>
              <div className="pt-2 px-2">
                <Slider
                  value={[options.visualization?.smoothing || 0]}
                  min={0}
                  max={10}
                  step={1}
                  onValueChange={(value: number[]) =>
                    handleChange('visualization', 'smoothing', value[0])
                  }
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="showRawData">Show Raw Data</Label>
                <Switch
                  id="showRawData"
                  checked={options.visualization?.showRawData || false}
                  onCheckedChange={(checked: boolean) =>
                    handleChange('visualization', 'showRawData', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="showTrendlines">Show Trendlines</Label>
                <Switch
                  id="showTrendlines"
                  checked={options.visualization?.showTrendlines || false}
                  onCheckedChange={(checked: boolean) =>
                    handleChange('visualization', 'showTrendlines', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="showConfidenceIntervals">
                  Show Confidence Intervals
                </Label>
                <Switch
                  id="showConfidenceIntervals"
                  checked={
                    options.visualization?.showConfidenceIntervals || false
                  }
                  onCheckedChange={(checked: boolean) =>
                    handleChange(
                      'visualization',
                      'showConfidenceIntervals',
                      checked,
                    )
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="showAnnotations">Show Annotations</Label>
                <Switch
                  id="showAnnotations"
                  checked={options.visualization?.showAnnotations || false}
                  onCheckedChange={(checked: boolean) =>
                    handleChange('visualization', 'showAnnotations', checked)
                  }
                />
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  // Render compact version (dropdown with popover)
  if (compact) {
    return (
      <div className={cn('advanced-filtering-compact', className)}>
        <Popover>
          <PopoverTrigger>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <IconFilter className="h-4 w-4" />
              Advanced Filter
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <div className="w-80 sm:w-96 p-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-medium">Advanced Filters</h4>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={resetFilters}
                  className="h-8 w-8 p-0"
                >
                  <IconX className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex border-b mb-4">
                {(
                  ['time', 'emotions', 'patterns', 'visualization'] as const
                ).map((tab) => (
                  <button
                    key={tab}
                    className={cn(
                      'py-2 px-3 text-sm capitalize',
                      activeTab === tab
                        ? 'border-b-2 border-primary font-medium'
                        : 'text-gray-500 hover:text-gray-700',
                    )}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="max-h-96 overflow-y-auto">
                {renderFilterSection()}
              </div>

              <div className="mt-4 flex justify-end">
                <Button size="sm" onClick={applyFilters}>
                  Apply Filters
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    )
  }

  // Render full version
  return (
    <div
      className={cn(
        'advanced-filtering p-4 border rounded-md bg-gray-50 dark:bg-gray-900',
        className,
      )}
    >
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-sm font-medium">Advanced Filtering</h4>
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={resetFilters}>
            Reset
          </Button>
          <Button size="sm" onClick={applyFilters}>
            Apply Filters
          </Button>
        </div>
      </div>

      <div className="flex border-b mb-4">
        {(['time', 'emotions', 'patterns', 'visualization'] as const).map(
          (tab) => (
            <button
              key={tab}
              className={cn(
                'py-2 px-4 text-sm capitalize',
                activeTab === tab
                  ? 'border-b-2 border-primary font-medium'
                  : 'text-gray-500 hover:text-gray-700',
              )}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ),
        )}
      </div>

      {renderFilterSection()}
    </div>
  )
}

export default AdvancedFilteringComponent
