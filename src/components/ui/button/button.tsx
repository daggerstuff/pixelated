import * as React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '~/lib/utils'
import type { ButtonProps } from './button-types'
import { getAriaProps, getButtonClassName, isLinkButton } from './button-types'

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        destructive:
          'bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary:
          'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        ghost:
          'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      loading = false,
      loadingText,
      showSpinner = true,
      disabled = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      children,
      href,
      target,
      rel,
      ...props
    }: ButtonProps,
    ref: React.ForwardedRef<HTMLButtonElement | HTMLAnchorElement>
  ) => {
    // Determine if this should be a link
    const isLink = isLinkButton({ href })

    // Handle loading state text
    const content = loading && loadingText ? loadingText : children

    // Common props for both button and anchor
    const commonProps = {
      className: cn(
        buttonVariants({ variant, size, className }),
        getButtonClassName({ loading, disabled, fullWidth }),
      ),
      disabled: disabled || loading,
      ...getAriaProps({ loading, disabled, ...props }),
      ...props,
    }

    // Render spinner if loading
    const loadingSpinner = loading && showSpinner ? (
      <span
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        role="status"
        aria-label="Loading"
      />
    ) : null

    // Content wrapper
    const contentWrapper = (
      <>
        {loadingSpinner}
        {!loading && leftIcon}
        {content}
        {!loading && rightIcon}
      </>
    )

    // Render as link if href is provided
    if (isLink) {
      // Remove 'type' from commonProps for anchor
  const { type: _type, ...anchorProps } = commonProps as { type?: string }
      return (
        <a
          ref={ref as React.ForwardedRef<HTMLAnchorElement>}
          href={href}
          target={target}
          rel={target === '_blank' ? 'noopener noreferrer' : rel}
          {...anchorProps}
        >
          {contentWrapper}
        </a>
      )
    }

    // Render as button
    return (
      <button
        ref={ref as React.ForwardedRef<HTMLButtonElement>}
        type="button"
        {...commonProps}
      >
        {contentWrapper}
      </button>
    )
  },
)

Button.displayName = 'Button'

export { Button, type ButtonProps }
