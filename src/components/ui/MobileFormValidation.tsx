import React, { useState, useEffect, useRef, useCallback } from 'react'

interface ValidationRule {
  test: (value: string) => boolean
  message: string
}

interface ValidationConfig {
  [key: string]: ValidationRule[]
}

interface MobileFormValidationProps {
  children: React.ReactNode
  onValidationChange?: (
    isValid: boolean,
    errors: Record<string, string>,
  ) => void
  validationRules: ValidationConfig
  validateOnChange?: boolean
  validateOnBlur?: boolean
  validateOnSubmit?: boolean
  focusFirstInvalidField?: boolean
  showErrorSummary?: boolean
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
}: MobileFormValidationProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [, setTouchedFields] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const [isMobile, setIsMobile] = useState(false)

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

  // Validate a specific field
  const validateField = useCallback((name: string, value: string): string => {
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

  // Handle input changes
  const handleChange = useCallback((e: Event) => {
    const input = e.target as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
    const name = input.getAttribute('name')
    if (!name) {
      return
    }

    // Mark field as touched
    setTouchedFields((prev) => {
      const newSet = new Set(prev)
      newSet.add(name)
      return newSet
    })

    if (validateOnChange) {
      const { value } = input
      const error = validateField(name, value)

      let newErrors: Record<string, string> = {};
      setErrors((prev) => {
        newErrors = { ...prev }
        if (error) {
          newErrors[name] = error
        } else {
          delete newErrors[name]
        }
        return newErrors
      })

      // Update ARIA attributes
      input.setAttribute('aria-invalid', error ? 'true' : 'false')

      if (onValidationChange) {
        onValidationChange(Object.keys(newErrors).length === 0, newErrors)
      }
    }
  }, [validateOnChange, validateField, onValidationChange])

  // Handle input blur
  const handleBlur = useCallback((e: Event) => {
    if (!validateOnBlur) {
      return
    }

    const input = e.target as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
    const name = input.getAttribute('name')
    if (!name) {
      return
    }

    const { value } = input
    const error = validateField(name, value)

    setErrors((prev) => {
      const newErrors = { ...prev }
      if (error) {
        newErrors[name] = error
      } else {
        delete newErrors[name]
      }
      return newErrors
    })

    // Update ARIA attributes
    input.setAttribute('aria-invalid', error ? 'true' : 'false')
  }, [validateOnBlur, validateField])

  // Find and enhance all form inputs with validation attributes
  useEffect(() => {
    const form = formRef.current
    if (!form) {
      return
    }

    const inputs = form.querySelectorAll('input, textarea, select')

    inputs.forEach((input) => {
      const name = input.getAttribute('name')
      if (!name || !validationRules[name]) {
        return
      }

      // Add event listeners for input validation
      input.addEventListener('change', handleChange)
      input.addEventListener('blur', handleBlur)

      // Add ARIA attributes
      input.setAttribute('aria-required', 'true')

      // Enhanced feedback for mobile
      if (isMobile) {
        // Make touch targets easier
        input.classList.add('mobile-input')
      }
    })

    // Clean up event listeners
    return () => {
      inputs.forEach((input) => {
        input.removeEventListener('change', handleChange)
        input.removeEventListener('blur', handleBlur)
      })
    }
  }, [validationRules, isMobile, handleChange, handleBlur, formRef])



  // Validate all fields in the form
  const validateForm = (): Record<string, string> => {
    const newErrors: Record<string, string> = {}

    if (!formRef.current) {
      return newErrors
    }

    const form = formRef.current
    const inputs = form.querySelectorAll('input, textarea, select')

    inputs.forEach((input) => {
      const name = input.getAttribute('name')
      if (!name || !validationRules[name]) {
        return
      }

      const { value } = input as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
      const error = validateField(name, value)

      if (error) {
        newErrors[name] = error

        // Update ARIA attributes
        input.setAttribute('aria-invalid', 'true')
        const errorId = `${name}-error`
        input.setAttribute('aria-describedby', errorId)
      } else {
        input.setAttribute('aria-invalid', 'false')
      }
    })

    return newErrors
  }



  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    if (validateOnSubmit) {
      // Mark all fields as touched
      if (formRef.current) {
        const inputs = formRef.current.querySelectorAll(
          'input, textarea, select',
        )
        const fieldNames = new Set<string>()
        inputs.forEach((input) => {
          const name = input.getAttribute('name')
          if (name) {
            fieldNames.add(name)
          }
        })
        setTouchedFields(fieldNames)
      }

      // Validate all fields
      const newErrors = validateForm()
      setErrors(newErrors)
      setSubmitted(true)

      // If there are errors, prevent form submission
      if (Object.keys(newErrors).length > 0) {
        e.preventDefault()

        // Focus first invalid field
        if (focusFirstInvalidField && formRef.current) {
          const firstErrorName = Object.keys(newErrors)[0]
          const firstErrorField = formRef.current.querySelector(
            `[name="${firstErrorName}"]`,
          )
          if (firstErrorField && 'scrollIntoView' in firstErrorField) {
            // Smooth scroll to the field
            firstErrorField.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            })

            // Wait for scroll to complete before focusing
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

        // Notify screen readers about validation errors
        if (isMobile) {
          const errorCount = Object.keys(newErrors).length
          const errorSummary = document.getElementById(
            'validation-error-summary',
          )
          if (errorSummary) {
            errorSummary.textContent = `Form has ${errorCount} ${errorCount === 1 ? 'error' : 'errors'}. Please correct before submitting.`
            errorSummary.setAttribute('role', 'alert')
          }
        }

        if (onValidationChange) {
          onValidationChange(false, newErrors)
        }
      } else if (onValidationChange) {
        onValidationChange(true, {})
      }
    }
  }

  // Clone the form element and inject our handlers
  const enhancedForm = React.Children.map(children, (child) => {
    if (React.isValidElement(child) && child.type === 'form') {
      const specificChild = child as React.ReactElement<
        React.FormHTMLAttributes<HTMLFormElement>
      >
      // Set up form props with the right type
      const formProps: React.FormHTMLAttributes<HTMLFormElement> & {
        ref: React.RefObject<HTMLFormElement | null>
      } = {
        ...specificChild.props,
        ref: formRef,
        onSubmit: (e: React.FormEvent<HTMLFormElement>) => {
          handleSubmit(e)
          // Call the original onSubmit if it exists
          if (specificChild.props.onSubmit) {
            specificChild.props.onSubmit(e)
          }
        },
        noValidate: true, // Disable browser validation in favor of our custom validation
      }

      return React.cloneElement(specificChild, formProps)
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
      ></div>

      {/* Error summary for accessibility and mobile UX */}
      {showErrorSummary && submitted && Object.keys(errors).length > 0 && (
        <div className="validation-error-summary" role="alert">
          <h3>Please correct the following errors:</h3>
          <ul>
            {Object.entries(errors).map(([field, error]) => (
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

// Commonly used validation rules
export const ValidationRules = {
  required: (message = 'This field is required'): ValidationRule => ({
    test: (value) => value.trim() !== '',
    message,
  }),
  email: (message = 'Please enter a valid email address'): ValidationRule => ({
    test: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message,
  }),
  minLength: (length: number, message?: string): ValidationRule => ({
    test: (value) => value.length >= length,
    message: message || `Must be at least ${length} characters`,
  }),
  maxLength: (length: number, message?: string): ValidationRule => ({
    test: (value) => value.length <= length,
    message: message || `Must be no more than ${length} characters`,
  }),
  pattern: (regex: RegExp, message: string): ValidationRule => ({
    test: (value) => regex.test(value),
    message,
  }),
  match: (fieldName: string, message: string): ValidationRule => ({
    test: (value) => {
      const matchField = document.querySelector(
        `[name="${fieldName}"]`,
      ) as HTMLInputElement
      return matchField && matchField.value === value
    },
    message,
  }),
}
