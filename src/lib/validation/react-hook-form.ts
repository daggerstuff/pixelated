/**
 * React Hook Form integration utilities with Zod validation
 */

import { useForm, type UseFormReturn, type FieldValues } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState, useCallback } from 'react'
import { normalizeError, getFieldErrors, type ValidationError } from '@/lib/error'

export interface UseValidatedFormOptions<T extends FieldValues> {
  schema: z.ZodType<T>
  defaultValues?: Partial<T>
  onSubmit: (data: T) => void | Promise<void>
  onError?: (error: ValidationError) => void
}

export interface UseValidatedFormReturn<T extends FieldValues> {
  form: UseFormReturn<T>
  handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>
  isSubmitting: boolean
  fieldErrors: Record<string, string>
  clearErrors: () => void
}

/**
 * Hook for form validation with React Hook Form and Zod
 */
export function useValidatedForm<T extends FieldValues>({
  schema,
  defaultValues,
  onSubmit,
  onError,
}: UseValidatedFormOptions<T>): UseValidatedFormReturn<T> {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const form = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as T,
    mode: 'onChange', // Validate on change for real-time feedback
  })

  const handleSubmit = useCallback(
    async (e?: React.BaseSyntheticEvent) => {
      if (e) {
        e.preventDefault()
      }

      setIsSubmitting(true)
      setFieldErrors({})

      try {
        const isValid = await form.trigger()
        if (!isValid) {
          const errors = form.formState.errors
          const fieldErrorMap: Record<string, string> = {}
          Object.keys(errors).forEach((key) => {
            const error = errors[key as keyof typeof errors]
            if (error?.message) {
              fieldErrorMap[key] = String(error.message)
            }
          })
          setFieldErrors(fieldErrorMap)
          setIsSubmitting(false)
          return
        }

        const data = form.getValues()
        await onSubmit(data)
      } catch (error) {
        const normalized = normalizeError(error)
        const fieldErrs = getFieldErrors(error) ?? {}

        if (normalized instanceof ValidationError) {
          setFieldErrors(normalized.fieldErrors ?? fieldErrs)
        } else {
          setFieldErrors(fieldErrs)
        }

        if (onError && normalized instanceof ValidationError) {
          onError(normalized)
        }
      } finally {
        setIsSubmitting(false)
      }
    },
    [form, onSubmit, onError],
  )

  const clearErrors = useCallback(() => {
    form.clearErrors()
    setFieldErrors({})
  }, [form])

  return {
    form,
    handleSubmit,
    isSubmitting,
    fieldErrors,
    clearErrors,
  }
}

/**
 * Get field error message from form state
 */
export function getFormFieldError<T extends FieldValues>(
  form: UseFormReturn<T>,
  fieldName: keyof T,
): string | undefined {
  const error = form.formState.errors[fieldName]
  return error?.message ? String(error.message) : undefined
}

/**
 * Check if field has error
 */
export function hasFormFieldError<T extends FieldValues>(
  form: UseFormReturn<T>,
  fieldName: keyof T,
): boolean {
  return !!form.formState.errors[fieldName]
}

/**
 * Check if field is touched
 */
export function isFormFieldTouched<T extends FieldValues>(
  form: UseFormReturn<T>,
  fieldName: keyof T,
): boolean {
  return !!form.formState.touchedFields[fieldName]
}

/**
 * Check if field is dirty
 */
export function isFormFieldDirty<T extends FieldValues>(
  form: UseFormReturn<T>,
  fieldName: keyof T,
): boolean {
  return !!form.formState.dirtyFields[fieldName]
}

