import * as React from 'react'
import { cn } from '@/lib/utils'

interface LabelProps extends React.ComponentPropsWithoutRef<'label'> {
  htmlFor?: string; // Make htmlFor explicit in the interface
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, htmlFor, ...props }, ref) => {
    // Warn if no htmlFor is provided
    if (process.env['NODE_ENV'] !== 'production' && !htmlFor) {
      console.warn(
        'Label component should have an htmlFor prop to associate it with a form control'
      )
    }

    return (
      <label
        ref={ref}
        htmlFor={htmlFor} // Ensure htmlFor is passed to the label
        className={cn(
          'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
          className,
        )}
        {...props}
      />
    )
  }
)
Label.displayName = 'Label'

export { Label }
