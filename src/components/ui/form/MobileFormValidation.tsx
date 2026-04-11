import React, { useState, useEffect, useRef, useCallback } from 'react'

import { isFormField } from './form-validation-types'
import type {
  ValidationRule,
  FormErrors,
  MobileFormValidationProps,
  FormState,
  ValidationResult,
} from './form-validation-types'

function isFormElement(
  child: React.ReactElement,
): child is React.ReactElement<
  React.FormHTMLAttributes<HTMLFormElement>,
  'form'
> {
  return child.type === 'form'
}

/**
 * Enhanced form validation component optimized for mobile devices
 * Provides real-time validation feedback with improved UX for touch interfaces
 */
export function MobileFormValidation({
  children,
  onValidationChange,
  validationRules,
  validateOnChange = true,
  validateOnBlur = true,
  validateOnSubmit = true,
  focusFirstInvalidField = true,
  showErrorSummary = false,
}: MobileFormValidationProps<Record<string, string>>) {
  // Strongly typed state
  const [formState, setFormState] = useState<FormState<Record<string, string>>>({
    values: {},
    errors: {},
    touched: {},
    dirty: {},
    isValid: true,
    isSubmitting: false,
    submitCount: 0,
  })

  const [isMobile, setIsMobile] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  // Detect mobile device on component mount
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice =
        window.matchMedia('(max-width: 767px)').matches ||
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      setIsMobile(isMobileDevice)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Validate a specific field with proper type inference
  const validateField = useCallback(
    (name: keyof Record<string, string>, value: string): string => {
      const rules = validationRules[name]
      if (!rules) {
        return ''
      }

      for (const rule of rules) {
        if (!rule.test(value)) {
          return rule.message
        }
      }

      return ''
    },
    [validationRules],
  )

  const updateErrors = (
    prevErrors: FormErrors<Record<string, string>>,
    fieldName: keyof Record<string, string>,
    message: string,
  ): FormErrors<Record<string, string>> => {
    const nextErrors = { ...prevErrors }
    if (message) {
      nextErrors[fieldName] = message
    } else {
      delete nextErrors[fieldName]
    }
    return nextErrors
  }

  // Handle input changes with proper type inference
  const handleChange = useCallback(
    (e: Event) => {
      const { target } = e
      if (!(target instanceof Element) || !isFormField(target)) {
        return
      }

      const input = target
      const { name } = input
      if (!name) {
        return
      }

      const value = input.value

      // Update form state
      setFormState((prev) => ({
        ...prev,
        values: { ...prev.values, [name]: value },
        dirty: { ...prev.dirty, [name]: true },
      }))

      if (validateOnChange) {
        const error = validateField(name, value)

        setFormState((prev) => {
          const newErrors = updateErrors(prev.errors, name, error)

          const isValid = Object.keys(newErrors).length === 0

          return {
            ...prev,
            errors: newErrors,
            isValid,
          }
        })

        // Update ARIA attributes
        input.setAttribute('aria-invalid', error ? 'true' : 'false')

        if (onValidationChange) {
          onValidationChange(formState.isValid, formState.errors)
        }
      }
    },
    [validateOnChange, validateField, onValidationChange, formState],
  )

  // Handle input blur with proper type inference
  const handleBlur = useCallback(
    (e: Event) => {
      if (!validateOnBlur) {
        return
      }

      const { target } = e
      if (!(target instanceof Element) || !isFormField(target)) {
        return
      }

      const input = target
      const { name } = input
      if (!name) {
        return
      }

      const value = input.value

      // Update touched state
      setFormState((prev) => ({
        ...prev,
        touched: { ...prev.touched, [name]: true },
      }))

      const error = validateField(name, value)

      setFormState((prev) => {
        const newErrors = updateErrors(prev.errors, name, error)

        return {
          ...prev,
          errors: newErrors,
          isValid: Object.keys(newErrors).length === 0,
        }
      })

      // Update ARIA attributes
      input.setAttribute('aria-invalid', error ? 'true' : 'false')
    },
    [validateOnBlur, validateField],
  )

  // Validate entire form with proper type inference
  const validateForm = useCallback((): ValidationResult<Record<string, string>> => {
    const newErrors: FormErrors<Record<string, string>> = {}
    let isValid = true

    if (!formRef.current) {
      return { isValid: true, errors: {} }
    }

    const form = formRef.current
    const inputs = form.querySelectorAll('input, textarea, select')

    inputs.forEach((input) => {
      if (!isFormField(input)) {
        return
      }

      const { name } = input
      if (!name) {
        return
      }
      if (!name || !validationRules[name]) {
        return
      }

      const value = input.value
      const error = validateField(name, value)

      if (error) {
        newErrors[name] = error
        isValid = false

        // Update ARIA attributes
        input.setAttribute('aria-invalid', 'true')
        const errorId = `${name}-error`
        input.setAttribute('aria-describedby', errorId)
      } else {
        input.setAttribute('aria-invalid', 'false')
        input.removeAttribute('aria-describedby')
      }
    })

    return { isValid, errors: newErrors }
  }, [validationRules, validateField])

  // Handle form submission with proper type inference
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      if (!validateOnSubmit) {
        return
      }

      setFormState((prev) => ({
        ...prev,
        isSubmitting: true,
        submitCount: prev.submitCount + 1,
      }))

      const { isValid, errors } = validateForm()

      setFormState((prev) => ({
        ...prev,
        isValid,
        errors,
        isSubmitting: false,
      }))

      if (!isValid) {
        e.preventDefault()

        // Focus first invalid field
        if (focusFirstInvalidField && formRef.current) {
          const firstErrorName = Object.keys(errors)[0]
          if (firstErrorName) {
            const firstErrorField = formRef.current.querySelector(
              `[name="${firstErrorName}"]`,
            )

            if (firstErrorField && 'scrollIntoView' in firstErrorField) {
              firstErrorField.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              })

              setTimeout(() => {
                if (firstErrorField instanceof HTMLElement) {
                  firstErrorField.focus()

                  // Vibrate for haptic feedback on mobile
                  if (isMobile && 'vibrate' in navigator) {
                    navigator.vibrate([50, 100, 50])
                  }
                }
              }, 500)
            }
          }
        }

        // Notify screen readers
        if (isMobile) {
          const errorCount = Object.keys(errors).length
          const errorSummary = document.getElementById('validation-error-summary')
          if (errorSummary) {
            errorSummary.textContent = `Form has ${errorCount} ${
              errorCount === 1 ? 'error' : 'errors'
            }. Please correct before submitting.`
            errorSummary.setAttribute('role', 'alert')
          }
        }

        if (onValidationChange) {
          onValidationChange(false, errors)
        }
      } else if (onValidationChange) {
        onValidationChange(true, {})
      }
    },
    [
      validateOnSubmit,
      validateForm,
      focusFirstInvalidField,
      isMobile,
      onValidationChange,
    ],
  )

  // Set up form with validation attributes and event handlers
  useEffect(() => {
    const form = formRef.current
    if (!form) {
      return
    }

    const inputs = form.querySelectorAll('input, textarea, select')

    inputs.forEach((input) => {
      if (isFormField(input)) {
        const { name } = input
        if (name && validationRules[name]) {
          input.setAttribute('name', name)
          input.setAttribute('aria-required', 'true')
          input.addEventListener('change', handleChange)
          input.addEventListener('blur', handleBlur)

          // Enhanced mobile styling
          if (isMobile) {
            input.classList.add('mobile-input')
          }
        }
      }
    })

    // Clean up
      // eslint-disable-next-line consistent-return
      return () => {
      inputs.forEach((input) => {
        if (isFormField(input)) {
          input.removeEventListener('change', handleChange)
          input.removeEventListener('blur', handleBlur)
        }
      })
    }
  }, [validationRules, isMobile, handleChange, handleBlur])

  // Clone and enhance form element
  const enhancedForm = React.Children.map(
    children,
    (child): React.ReactNode => {
      if (React.isValidElement(child) && isFormElement(child)) {
        const formChild = child
        return React.cloneElement(formChild, {
          onSubmit: (e: React.FormEvent<HTMLFormElement>) => {
            formRef.current = e.currentTarget
            handleSubmit(e)
          },
          noValidate: true,
        })
      }
      return child
    }
  )

  return (
    <>
      {enhancedForm}

      {/* Hidden element for screen reader announcements */}
      <div
        id='validation-error-summary'
        className='sr-only'
        aria-live='assertive'
      />

      {/* Error summary for accessibility and mobile UX */}
      {showErrorSummary && formState.submitCount > 0 && !formState.isValid && (
        <div className='validation-error-summary' role='alert'>
          <h3>Please correct the following errors:</h3>
          <ul>
            {Object.entries(formState.errors).map(([field, error]) => (
              <li key={field}>
                <a
                  href={`#${field}`}
                  onClick={(e) => {
                    e.preventDefault()
                    const element = document.querySelector<HTMLElement>(
                      `[name="${field}"]`,
                    )
                    if (element instanceof HTMLElement) {
                      element.focus()
                      element.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                      })
                    }
                  }}
                >
                  {error}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

// Helper functions for generic validation rules
function createRequiredRule<T>(
  message = 'This field is required',
): ValidationRule<T> {
  return {
    test: (value: T) => {
      if (typeof value === 'string') {
        return value.trim() !== ''
      }
      return value !== undefined
    },
    message,
  }
}

function createCustomRule<T>(
  test: (value: T) => boolean,
  message: string,
): ValidationRule<T> {
  return {
    test,
    message,
  }
}

// Export validation rules with proper typing
export const ValidationRules = {
  required: createRequiredRule,
  email: (message = 'Please enter a valid email address'): ValidationRule => ({
    test: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message,
  }),
  minLength: (length: number, message?: string): ValidationRule => ({
    test: (value) => value.length >= length,
    message: message ?? `Must be at least ${length} characters`,
  }),
  maxLength: (length: number, message?: string): ValidationRule => ({
    test: (value) => value.length <= length,
    message: message ?? `Must be no more than ${length} characters`,
  }),
  pattern: (regex: RegExp, message: string): ValidationRule => ({
    test: (value) => regex.test(value),
    message,
  }),
  match: (fieldName: string, message: string): ValidationRule => ({
    test: (value) => {
      const matchField = document.querySelector<HTMLInputElement>(
        `[name="${fieldName}"]`,
      )
      return matchField?.value === value
    },
    message,
  }),
  custom: createCustomRule,
}
