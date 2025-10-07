import type { ReactNode } from 'react'

/**
 * Generic type for form values
 */
export type FormValues = Record<string, unknown>

/**
 * Validation rule interface with generic value type
 */
export interface ValidationRule<T = string> {
  test: (value: T) => boolean
  message: string
}

/**
 * Validation configuration with generic types
 */
export type ValidationConfig<T extends FormValues = FormValues> = {
  [K in keyof T]?: ValidationRule<T[K]>[]
}

/**
 * Form errors type with generic form values
 */
export type FormErrors<T extends FormValues = FormValues> = {
  [K in keyof T]?: string
}

/**
 * Props for the MobileFormValidation component with generic form values
 */
export interface MobileFormValidationProps<T extends FormValues = FormValues> {
  /** Form children */
  children: ReactNode
  /** Callback for validation state changes */
  onValidationChange?: (isValid: boolean, errors: FormErrors<T>) => void
  /** Validation rules configuration */
  validationRules: ValidationConfig<T>
  /** Whether to validate on input change */
  validateOnChange?: boolean
  /** Whether to validate on input blur */
  validateOnBlur?: boolean
  /** Whether to validate on form submit */
  validateOnSubmit?: boolean
  /** Whether to focus the first invalid field */
  focusFirstInvalidField?: boolean
  /** Whether to show error summary */
  showErrorSummary?: boolean
}

/**
 * Form field state interface
 */
export interface FormFieldState {
  touched: boolean
  dirty: boolean
  error?: string
  value: unknown
}

/**
 * Form state with generic values
 */
export type FormState<T extends FormValues = FormValues> = {
  values: T
  errors: FormErrors<T>
  touched: { [K in keyof T]?: boolean }
  dirty: { [K in keyof T]?: boolean }
  isValid: boolean
  isSubmitting: boolean
  submitCount: number
}

/**
 * Form validation result with generic values
 */
export interface ValidationResult<T extends FormValues = FormValues> {
  isValid: boolean
  errors: FormErrors<T>
}

/**
 * Common validation rules with generic value types
 */
export interface ValidationRuleCreators {
  required: (message?: string) => ValidationRule
  email: (message?: string) => ValidationRule
  minLength: (length: number, message?: string) => ValidationRule
  maxLength: (length: number, message?: string) => ValidationRule
  pattern: (regex: RegExp, message: string) => ValidationRule
  match: (fieldName: string, message: string) => ValidationRule
  custom: <T>(test: (value: T) => boolean, message: string) => ValidationRule<T>
}

/**
 * Form field validation props
 */
export interface FormFieldValidationProps {
  name: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  'aria-required'?: boolean
  onBlur?: (event: React.FocusEvent) => void
  onChange?: (event: React.ChangeEvent) => void
}

/**
 * Form validation context with generic values
 */
export interface FormValidationContext<T extends FormValues = FormValues> {
  formState: FormState<T>
  validateField: (name: keyof T, value: T[keyof T]) => string | undefined
  setFieldValue: (name: keyof T, value: T[keyof T]) => void
  setFieldTouched: (name: keyof T, touched?: boolean) => void
  setFieldError: (name: keyof T, error?: string) => void
  validateForm: () => Promise<ValidationResult<T>>
  submitForm: () => Promise<void>
  resetForm: (values?: Partial<T>) => void
}

/**
 * Type guard to check if a value is a form field
 */
export function isFormField(element: Element): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return element instanceof HTMLInputElement ||
         element instanceof HTMLTextAreaElement ||
         element instanceof HTMLSelectElement
}

/**
 * Type guard to check if an error is a validation error
 */
export function isValidationError(error: unknown): error is { message: string } {
  return typeof error === 'object' && 
         error !== null && 
         'message' in error &&
         typeof (error as { message: unknown }).message === 'string'
}

/**
 * Helper type for form field values
 */
export type FieldValue<T extends FormValues, K extends keyof T> = T[K]

/**
 * Helper type for form field validation rules
 */
export type FieldValidationRules<T extends FormValues, K extends keyof T> = ValidationRule<T[K]>[]

/**
 * Helper function to create a validation rule with proper typing
 */
export function createValidationRule<T>(test: (value: T) => boolean, message: string): ValidationRule<T> {
  return { test, message }
}

/**
 * Helper function to create a validation config with proper typing
 */
export function createValidationConfig<T extends FormValues>(config: ValidationConfig<T>): ValidationConfig<T> {
  return config
}
