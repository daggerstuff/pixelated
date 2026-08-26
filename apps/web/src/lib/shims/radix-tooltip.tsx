import React from 'react'

export function Provider(props: {
  children?: React.ReactNode
}): React.JSX.Element {
  return <>{props.children}</>
}

export function Root(props: { children?: React.ReactNode }): React.JSX.Element {
  return <>{props.children}</>
}

export const Trigger = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement> & { asChild?: boolean }
>(({ asChild, children, ...rest }, ref) => {
  return (
    <span ref={ref} {...rest}>
      {children}
    </span>
  )
})
Trigger.displayName = 'Tooltip.Trigger'

export const Content = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { sideOffset?: number }
>(({ children, ...rest }, ref) => {
  return (
    <div ref={ref} role="tooltip" {...rest}>
      {children}
    </div>
  )
})
Content.displayName = 'Tooltip.Content'
