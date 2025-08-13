import type { ComponentProps } from 'react'
import type { VariantProps } from 'class-variance-authority'
import { buttonVariants } from './button'

export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'

export interface ButtonBaseProps {
  /** Additional class names to apply to the button */
  className?: string
  /** Whether the button is in a loading state */
  loading?: boolean
  /** Loading text to display when in loading state */
  loadingText?: string
  /** Whether to show the loading spinner */
  showSpinner?: boolean
  /** Whether the button is disabled */
  disabled?: boolean
  /** Whether the button should take up the full width of its container */
  fullWidth?: boolean
  /** Whether the button should be rendered as a different element */
  asChild?: boolean
  /** ARIA label for accessibility */
  'aria-label'?: string
  /** ARIA description for accessibility */
  'aria-description'?: string
}

export interface ButtonProps extends 
  ButtonBaseProps,
  Omit<ComponentProps<'button'>, keyof ButtonBaseProps>,
  VariantProps<typeof buttonVariants> {
  /** The variant style to use */
  variant?: ButtonVariant
  /** The size of the button */
  size?: ButtonSize
  /** Left icon component */
  leftIcon?: React.ReactNode
  /** Right icon component */
  rightIcon?: React.ReactNode
  /** Whether the button should be rendered as a link */
  href?: string
  /** Target attribute for link buttons */
  target?: string
  /** Rel attribute for link buttons */
  rel?: string
}

// Type guard to check if a button has href prop
export function isLinkButton(props: ButtonProps): props is ButtonProps & Required<Pick<ButtonProps, 'href'>> {
  return 'href' in props && typeof props.href === 'string'
}

// Type guard for loading state
export function isLoadingButton(props: ButtonProps): props is ButtonProps & Required<Pick<ButtonProps, 'loading'>> {
  return 'loading' in props && props.loading === true
}

// Variant type helpers
export const BUTTON_VARIANTS: ButtonVariant[] = [
  'default',
  'destructive',
  'outline',
  'secondary',
  'ghost',
  'link',
]

export const BUTTON_SIZES: ButtonSize[] = ['default', 'sm', 'lg', 'icon']

// Accessibility helpers
export function getAriaProps(props: ButtonProps) {
  return {
    'aria-label': props['aria-label'],
    'aria-description': props['aria-description'],
    'aria-disabled': props.disabled,
    'aria-busy': props.loading,
  }
}

// Class name helpers
export function getButtonClassName(props: ButtonProps): string {
  const classes: string[] = []

  if (props.fullWidth) {
    classes.push('w-full')
  }

  if (props.loading) {
    classes.push('cursor-wait')
  }

  if (props.disabled) {
    classes.push('cursor-not-allowed')
  }

  return classes.join(' ')
}
