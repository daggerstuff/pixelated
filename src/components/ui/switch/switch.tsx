import * as React from 'react';

// This is a dependency-free placeholder to allow the server to run.
export interface SwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  showLabel?: boolean;
  labelPosition?: 'left' | 'right';
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ label, ...props }, ref) => (
    <button ref={ref} {...props} type="button">
      {label}
    </button>
  )
);
Switch.displayName = 'Switch';

export { Switch };
