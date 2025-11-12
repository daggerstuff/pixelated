import { useState, useEffect } from 'react'
import {
  CreateSessionPayloadSchema,
  UpdateSessionPayloadSchema,
  type CreateSessionPayload,
  type UpdateSessionPayload,
  type Session,
} from '@/lib/api/journal-research/types'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button/button'
import { cn } from '@/lib/utils'

export interface SessionFormProps {
  session?: Session
  onSubmit: (data: CreateSessionPayload | UpdateSessionPayload) => void | Promise<void>
  onCancel?: () => void
  isLoading?: boolean
  className?: string
}

const availableSources = ['pubmed', 'doaj', 'arxiv', 'ieee', 'acm']

export function SessionForm({
  session,
  onSubmit,
  onCancel,
  isLoading = false,
  className,
}: SessionFormProps) {
  const isEdit = !!session
  const schema = isEdit ? UpdateSessionPayloadSchema : CreateSessionPayloadSchema

  const [formData, setFormData] = useState<CreateSessionPayload | UpdateSessionPayload>({
    sessionId: session?.sessionId,
    targetSources: session?.targetSources ?? ['pubmed', 'doaj'],
    searchKeywords: session?.searchKeywords ?? {},
    weeklyTargets: session?.weeklyTargets ?? {},
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [keywordInput, setKeywordInput] = useState('')
  const [keywordCategory, setKeywordCategory] = useState('default')

  useEffect(() => {
    if (session) {
      setFormData({
        targetSources: session.targetSources,
        searchKeywords: session.searchKeywords,
        weeklyTargets: session.weeklyTargets,
        currentPhase: session.currentPhase,
      })
    }
  }, [session])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    try {
      const validated = schema.parse(formData)
      await onSubmit(validated)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {}
        error.errors.forEach((err) => {
          const path = err.path.join('.')
          fieldErrors[path] = err.message
        })
        setErrors(fieldErrors)
      }
    }
  }

  const handleSourceToggle = (source: string) => {
    const current = formData.targetSources ?? []
    const updated = current.includes(source)
      ? current.filter((s) => s !== source)
      : [...current, source]
    setFormData({ ...formData, targetSources: updated })
  }

  const handleAddKeyword = () => {
    if (!keywordInput.trim()) return

    const keywords = formData.searchKeywords ?? {}
    const category = keywordCategory || 'default'
    const categoryKeywords = keywords[category] ?? []
    
    if (!categoryKeywords.includes(keywordInput.trim())) {
      setFormData({
        ...formData,
        searchKeywords: {
          ...keywords,
          [category]: [...categoryKeywords, keywordInput.trim()],
        },
      })
      setKeywordInput('')
    }
  }

  const handleRemoveKeyword = (category: string, keyword: string) => {
    const keywords = formData.searchKeywords ?? {}
    const categoryKeywords = keywords[category] ?? []
    setFormData({
      ...formData,
      searchKeywords: {
        ...keywords,
        [category]: categoryKeywords.filter((k) => k !== keyword),
      },
    })
  }

  const handleWeeklyTargetChange = (week: string, value: string) => {
    const numValue = parseInt(value, 10)
    if (!isNaN(numValue) && numValue >= 0) {
      setFormData({
        ...formData,
        weeklyTargets: {
          ...(formData.weeklyTargets ?? {}),
          [week]: numValue,
        },
      })
    }
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle>{isEdit ? 'Edit Session' : 'Create New Session'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="sessionId">Session ID (optional)</Label>
              <input
                id="sessionId"
                type="text"
                value={(formData as CreateSessionPayload).sessionId ?? ''}
                onChange={(e) =>
                  setFormData({ ...formData, sessionId: e.target.value })
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Leave empty for auto-generated ID"
              />
              {errors.sessionId && (
                <p className="text-sm text-red-500">{errors.sessionId}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Target Sources</Label>
            <div className="flex flex-wrap gap-2">
              {availableSources.map((source) => (
                <label
                  key={source}
                  className="flex cursor-pointer items-center gap-2 rounded-md border p-2 hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={(formData.targetSources ?? []).includes(source)}
                    onChange={() => handleSourceToggle(source)}
                    className="rounded"
                  />
                  <span className="text-sm capitalize">{source}</span>
                </label>
              ))}
            </div>
            {errors.targetSources && (
              <p className="text-sm text-red-500">{errors.targetSources}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Search Keywords</Label>
            <div className="flex gap-2">
              <input
                type="text"
                value={keywordCategory}
                onChange={(e) => setKeywordCategory(e.target.value)}
                placeholder="Category"
                className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddKeyword()
                  }
                }}
                placeholder="Enter keyword"
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button
                type="button"
                onClick={handleAddKeyword}
                variant="outline"
                size="sm"
              >
                Add
              </Button>
            </div>
            <div className="mt-2 space-y-2">
              {Object.entries(formData.searchKeywords ?? {}).map(
                ([category, keywords]) =>
                  keywords.length > 0 && (
                    <div key={category}>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        {category}:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {keywords.map((keyword) => (
                          <span
                            key={keyword}
                            className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs"
                          >
                            {keyword}
                            <button
                              type="button"
                              onClick={() => handleRemoveKeyword(category, keyword)}
                              className="text-muted-foreground hover:text-foreground"
                              aria-label={`Remove ${keyword}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ),
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Weekly Targets</Label>
            <div className="grid grid-cols-4 gap-2">
              {['week1', 'week2', 'week3', 'week4'].map((week) => (
                <div key={week} className="space-y-1">
                  <Label htmlFor={week} className="text-xs capitalize">
                    {week}
                  </Label>
                  <input
                    id={week}
                    type="number"
                    min="0"
                    value={
                      (formData.weeklyTargets ?? {})[week]?.toString() ?? '0'
                    }
                    onChange={(e) =>
                      handleWeeklyTargetChange(week, e.target.value)
                    }
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {isEdit && 'currentPhase' in formData && (
            <div className="space-y-2">
              <Label htmlFor="currentPhase">Current Phase</Label>
              <select
                id="currentPhase"
                value={formData.currentPhase ?? ''}
                onChange={(e) =>
                  setFormData({ ...formData, currentPhase: e.target.value })
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="discovery">Discovery</option>
                <option value="evaluation">Evaluation</option>
                <option value="acquisition">Acquisition</option>
                <option value="integration">Integration</option>
                <option value="reporting">Reporting</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : isEdit ? 'Update Session' : 'Create Session'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

