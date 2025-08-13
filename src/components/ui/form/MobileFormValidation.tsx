import React, { useState, useEffect, useRef, useCallback } from 'react'
import { isFormField } from './form-validation-types'
import type {
  FormValues,
  ValidationRule,
  FormErrors,
  MobileFormValidationProps,
  FormState,
  ValidationResult,
  FormFieldValidationProps,
} from './form-validation-types';

/**
 * Enhanced form validation component optimized for mobile devices
 * Provides real-time validation feedback with improved UX for touch interfaces
 */
export function MobileFormValidation<T extends FormValues = FormValues>({
  children,
  onValidationChange,
  validationRules,
  validateOnChange = true,
  validateOnBlur = true,
  validateOnSubmit = true,
  focusFirstInvalidField = true,
  showErrorSummary = false,
}: MobileFormValidationProps<T>) {
  // Strongly typed state
  const [formState, setFormState] = useState<FormState<T>>({
    values: {} as T,
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
  const validateField = useCallback(<K extends keyof T>(
    name: K,
    value: T[K],
  ): string => {
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
  }, [validationRules])

  // Handle input changes with proper type inference
  const handleChange = useCallback((e: Event) => {
    const { target } = e
    if (!target || !isFormField(target as Element)) {
      return
    }

    const input = target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    const name = input.getAttribute('name')
    if (!name) {
      return
    }

    const value = input.value as T[keyof T]

    // Update form state
    setFormState((prev) => ({
      ...prev,
      values: { ...prev.values, [name]: value },
      dirty: { ...prev.dirty, [name]: true },
    }))

    if (validateOnChange) {
      const error = validateField(name as keyof T, value)

      setFormState((prev) => {
        const newErrors = { ...prev.errors } as Record<string, string>
        if (error) {
          newErrors[name] = error
        } else {
          delete newErrors[name]
        }

        const isValid = Object.keys(newErrors).length === 0

        return {
          ...prev,
          errors: newErrors as FormErrors<T>,
          isValid,
        }
      })

      // Update ARIA attributes
      input.setAttribute('aria-invalid', error ? 'true' : 'false')

      if (onValidationChange) {
        onValidationChange(
          formState.isValid,
          formState.errors as FormErrors<T>,
        )
      }
    }
  }, [validateOnChange, validateField, onValidationChange, formState])

  // Handle input blur with proper type inference
  const handleBlur = useCallback((e: Event) => {
    if (!validateOnBlur) {
      return
    }

    const {target} = e
    if (!target || !isFormField(target as Element)) {
      return
    }

    const input = target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    const name = input.getAttribute('name')
    if (!name) {
      return
    }

    const value = input.value as T[keyof T]

    // Update touched state
    setFormState((prev) => ({
      ...prev,
      touched: { ...prev.touched, [name]: true },
    }))

    const error = validateField(name as keyof T, value)

    setFormState((prev) => {
      const newErrors = { ...prev.errors } as Record<string, string>
      if (error) {
        newErrors[name] = error
      } else {
        delete newErrors[name]
      }

      return {
        ...prev,
        errors: newErrors as FormErrors<T>,
        isValid: Object.keys(newErrors).length === 0,
      }
    })

    // Update ARIA attributes
    input.setAttribute('aria-invalid', error ? 'true' : 'false')
  }, [validateOnBlur, validateField])

  // Validate entire form with proper type inference
  const validateForm = useCallback((): ValidationResult<T> => {
    const newErrors: FormErrors<T> = {}
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

      const name = input.getAttribute('name')
      if (!name || !validationRules[name as keyof T]) {
        return
      }

      const value = input.value as T[keyof T]
      const error = validateField(name as keyof T, value)

      if (error) {
        newErrors[name as keyof T] = error
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
  const handleSubmit = useCallback((e: React.FormEvent) => {
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
  }, [
    validateOnSubmit,
    validateForm,
    focusFirstInvalidField,
    isMobile,
    onValidationChange,
  ])

  // Set up form with validation attributes and event handlers
  useEffect(() => {
    const form = formRef.current
    if (!form) {
      return
    }

    const inputs = form.querySelectorAll('input, textarea, select')

    inputs.forEach((input) => {
      if (!isFormField(input)) {
        return
      }

      const name = input.getAttribute('name')
      if (!name || !validationRules[name as keyof T]) {
        return
      }

      // Add validation attributes
      const validationProps: FormFieldValidationProps = {
        name,
        'aria-required': true,
        onChange: handleChange as unknown as React.ChangeEventHandler,
        onBlur: handleBlur as unknown as React.FocusEventHandler,
      }

      Object.entries(validationProps).forEach(([key, value]) => {
        if (value !== undefined) {
          input.setAttribute(key, value.toString())
        }
      })

      // Enhanced mobile styling
      if (isMobile) {
        input.classList.add('mobile-input')
      }
    })

    // Clean up
    return () => {
      inputs.forEach((input) => {
        if (!isFormField(input)) {
          return
        }
        input.removeEventListener('change', handleChange)
        input.removeEventListener('blur', handleBlur)
      })
    }
  }, [validationRules, isMobile, handleChange, handleBlur])

  // Clone and enhance form element
  const enhancedForm = React.Children.map(children, (child) => {
    if (React.isValidElement(child) && child.type === 'form') {
      const formChild = child as React.ReactElement<React.FormHTMLAttributes<HTMLFormElement>>
      return React.cloneElement(
        formChild,
        {
          ...formChild.props,
          ref: formRef,
          onSubmit: (e: React.FormEvent<HTMLFormElement>) => {
            handleSubmit(e)
            // Call original onSubmit if it exists
            if (formChild.props.onSubmit) {
              formChild.props.onSubmit(e)
            }
          },
          noValidate: true,
        } as React.FormHTMLAttributes<HTMLFormElement> & { ref: React.RefObject<HTMLFormElement> }
      )
    }
    return child
  })

  return (
    <>
      {enhancedForm}

      {/* Hidden element for screen reader announcements */}
      <div
        id="validation-error-summary"
        className="sr-only"
        aria-live="assertive"
      />

      {/* Error summary for accessibility and mobile UX */}
      {showErrorSummary && formState.submitCount > 0 && !formState.isValid && (
        <div className="validation-error-summary" role="alert">
          <h3>Please correct the following errors:</h3>
          <ul>
            {Object.entries(formState.errors).map(([field, error]) => (
              <li key={field}>
                <a
                  href={`#${field}`}
                  onClick={(e) => {
                    e.preventDefault()
                    const element = document.querySelector(`[name="${field}"]`)
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
function createRequiredRule<T>(message = 'This field is required'): ValidationRule<T> {
  return {
    test: (value: T) => {
      if (typeof value === 'string') {
        return value.trim() !== ''
      }
      return value !== undefined && value !== null
    },
    message,
  }
}

function createCustomRule<T>(test: (value: T) => boolean, message: string): ValidationRule<T> {
  return {
    test,
    message,
  }
}

// Export validation rules with proper typing
export const ValidationRules = {
  required: createRequiredRule,
  email: (message = 'Please enter a valid email address'): ValidationRule<string> => ({
    test: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message,
  }),
  minLength: (length: number, message?: string): ValidationRule<string> => ({
    test: (value) => value.length >= length,
    message: message || `Must be at least ${length} characters`,
  }),
  maxLength: (length: number, message?: string): ValidationRule<string> => ({
    test: (value) => value.length <= length,
    message: message || `Must be no more than ${length} characters`,
  }),
  pattern: (regex: RegExp, message: string): ValidationRule<string> => ({
    test: (value) => regex.test(value),
    message,
  }),
  match: (fieldName: string, message: string): ValidationRule<string> => ({
    test: (value) => {
      const matchField = document.querySelector(
        `[name="${fieldName}"]`,
      ) as HTMLInputElement
      return matchField && matchField.value === value
    },
    message,
  }),
  custom: createCustomRule,
}