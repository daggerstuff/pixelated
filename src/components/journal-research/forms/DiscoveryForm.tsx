import { useState } from 'react'
import {
  DiscoveryInitiatePayloadSchema,
  type DiscoveryInitiatePayload,
} from '@/lib/api/journal-research/types'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button/button'
import { cn } from '@/lib/utils'

export interface DiscoveryFormProps {
  onSubmit: (data: DiscoveryInitiatePayload) => void | Promise<void>
  onCancel?: () => void
  isLoading?: boolean
  className?: string
  defaultSources?: string[]
  defaultKeywords?: string[]
}

const availableSources = ['pubmed', 'doaj', 'arxiv', 'ieee', 'acm']

export function DiscoveryForm({
  onSubmit,
  onCancel,
  isLoading = false,
  className,
  defaultSources = ['pubmed', 'doaj'],
  defaultKeywords = [],
}: DiscoveryFormProps) {
  const [sources, setSources] = useState<string[]>(defaultSources)
  const [keywords, setKeywords] = useState<string[]>(defaultKeywords)
  const [keywordInput, setKeywordInput] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    try {
      const payload: DiscoveryInitiatePayload = {
        keywords,
        sources,
      }
      const validated = DiscoveryInitiatePayloadSchema.parse(payload)
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
    setSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source],
    )
  }

  const handleAddKeyword = () => {
    if (!keywordInput.trim()) return
    if (!keywords.includes(keywordInput.trim())) {
      setKeywords((prev) => [...prev, keywordInput.trim()])
      setKeywordInput('')
    }
  }

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords((prev) => prev.filter((k) => k !== keyword))
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle>Initiate Discovery</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
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
                    checked={sources.includes(source)}
                    onChange={() => handleSourceToggle(source)}
                    className="rounded"
                  />
                  <span className="text-sm capitalize">{source}</span>
                </label>
              ))}
            </div>
            {errors.sources && (
              <p className="text-sm text-red-500">{errors.sources}</p>
            )}
            {sources.length === 0 && (
              <p className="text-sm text-yellow-500">
                Please select at least one source
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="keywords">Search Keywords</Label>
            <div className="flex gap-2">
              <input
                id="keywords"
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
            {keywords.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs"
                  >
                    {keyword}
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(keyword)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Remove ${keyword}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            {errors.keywords && (
              <p className="text-sm text-red-500">{errors.keywords}</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isLoading || sources.length === 0}>
              {isLoading ? 'Starting Discovery...' : 'Start Discovery'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

