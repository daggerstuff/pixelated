import { useState, useEffect } from 'react'
import {
  EvaluationUpdatePayloadSchema,
  type EvaluationUpdatePayload,
  type Evaluation,
} from '@/lib/api/journal-research/types'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button/button'
import { cn } from '@/lib/utils'
import { normalizeError, getFieldErrors } from '@/lib/error'
import { ErrorMessage, FieldError } from '@/components/journal-research/shared/ErrorMessage'

export interface EvaluationFormProps {
  evaluation?: Evaluation
  onSubmit: (data: EvaluationUpdatePayload) => void | Promise<void>
  onCancel?: () => void
  isLoading?: boolean
  className?: string
}

const priorityTiers = ['high', 'medium', 'low']

export function EvaluationForm({
  evaluation,
  onSubmit,
  onCancel,
  isLoading = false,
  className,
}: EvaluationFormProps) {
  const [formData, setFormData] = useState<EvaluationUpdatePayload>({
    therapeuticRelevance: evaluation?.therapeuticRelevance,
    dataStructureQuality: evaluation?.dataStructureQuality,
    trainingIntegration: evaluation?.trainingIntegration,
    ethicalAccessibility: evaluation?.ethicalAccessibility,
    priorityTier: evaluation?.priorityTier,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitError, setSubmitError] = useState<unknown>(null)

  useEffect(() => {
    if (evaluation) {
      setFormData({
        therapeuticRelevance: evaluation.therapeuticRelevance,
        dataStructureQuality: evaluation.dataStructureQuality,
        trainingIntegration: evaluation.trainingIntegration,
        ethicalAccessibility: evaluation.ethicalAccessibility,
        priorityTier: evaluation.priorityTier,
      })
    }
  }, [evaluation])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setSubmitError(null)

    try {
      const validated = EvaluationUpdatePayloadSchema.parse(formData)
      await onSubmit(validated)
    } catch (error) {
      const normalized = normalizeError(error)
      const fieldErrs = getFieldErrors(error) ?? {}
      
      if (fieldErrs && Object.keys(fieldErrs).length > 0) {
        setErrors(fieldErrs)
      } else {
        setSubmitError(error)
      }
    }
  }

  const handleScoreChange = (field: keyof EvaluationUpdatePayload, value: string) => {
    const numValue = parseFloat(value)
    if (!isNaN(numValue) && numValue >= 1 && numValue <= 10) {
      setFormData({ ...formData, [field]: numValue })
    }
  }

  const metrics = [
    {
      key: 'therapeuticRelevance' as const,
      label: 'Therapeutic Relevance',
      description: 'How relevant is this dataset for therapeutic applications?',
    },
    {
      key: 'dataStructureQuality' as const,
      label: 'Data Structure Quality',
      description: 'How well-structured and usable is the data?',
    },
    {
      key: 'trainingIntegration' as const,
      label: 'Training Integration',
      description: 'How easily can this be integrated into training?',
    },
    {
      key: 'ethicalAccessibility' as const,
      label: 'Ethical Accessibility',
      description: 'How accessible is this data ethically and legally?',
    },
  ]

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle>
          {evaluation ? 'Update Evaluation' : 'Create Evaluation'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {metrics.map((metric) => (
            <div key={metric.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor={metric.key}>{metric.label}</Label>
                  <p className="text-xs text-muted-foreground">
                    {metric.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id={metric.key}
                    type="number"
                    min="1"
                    max="10"
                    step="0.1"
                    value={formData[metric.key]?.toString() ?? ''}
                    onChange={(e) => {
                      handleScoreChange(metric.key, e.target.value)
                      if (touched[metric.key]) {
                        setErrors((prev) => {
                          const next = { ...prev }
                          delete next[metric.key]
                          return next
                        })
                      }
                    }}
                    onBlur={() => {
                      setTouched((prev) => ({ ...prev, [metric.key]: true }))
                    }}
                    className={cn(
                      'w-20 rounded-md border bg-background px-2 py-1 text-right text-sm',
                      errors[metric.key] && touched[metric.key]
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : 'border-input',
                    )}
                    aria-invalid={!!errors[metric.key] && touched[metric.key]}
                    aria-describedby={errors[metric.key] && touched[metric.key] ? `${metric.key}-error` : undefined}
                  />
                  <span className="text-sm text-muted-foreground">/ 10</span>
                </div>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="0.1"
                value={formData[metric.key] ?? 5}
                onChange={(e) => {
                  handleScoreChange(metric.key, e.target.value)
                  if (touched[metric.key]) {
                    setErrors((prev) => {
                      const next = { ...prev }
                      delete next[metric.key]
                      return next
                    })
                  }
                }}
                onBlur={() => {
                  setTouched((prev) => ({ ...prev, [metric.key]: true }))
                }}
                className="w-full"
              />
              <FieldError error={errors[metric.key] && touched[metric.key] ? errors[metric.key] : undefined} />
            </div>
          ))}

          <div className="space-y-2">
            <Label htmlFor="priorityTier">Priority Tier</Label>
            <select
              id="priorityTier"
              value={formData.priorityTier ?? ''}
              onChange={(e) =>
                setFormData({ ...formData, priorityTier: e.target.value })
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select priority tier</option>
              {priorityTiers.map((tier) => (
                <option key={tier} value={tier}>
                  {tier.charAt(0).toUpperCase() + tier.slice(1)}
                </option>
              ))}
            </select>
            <FieldError error={errors.priorityTier} />
          </div>

          <ErrorMessage error={submitError} fieldErrors={errors} />

          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? 'Saving...'
                : evaluation
                  ? 'Update Evaluation'
                  : 'Create Evaluation'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

