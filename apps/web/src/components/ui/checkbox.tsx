import React, { type FC } from 'react'

interface CheckboxProps {
  'checked'?: boolean
  'defaultChecked'?: boolean
  'disabled'?: boolean
  'id'?: string
  'name'?: string
  'value'?: string
  'onChange'?: (checked: boolean) => void
  'className'?: string
  'children'?: React.ReactNode
  'aria-describedby'?: string
}

export const Checkbox: FC<CheckboxProps> = ({
  checked,
  defaultChecked = false,
  disabled = false,
  id,
  name,
  value,
  onChange,
  className = '',
  children,
  'aria-describedby': ariaDescribedBy,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.checked)
  }

  return (
    <label
      className={`flex cursor-pointer items-center ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`}
    >
      <input
        type="checkbox"
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        id={id}
        name={name}
        value={value}
        onChange={handleChange}
        aria-describedby={ariaDescribedBy}
        className="mr-2 h-4 w-4 rounded-none border-input bg-secondary text-primary focus:ring-2 focus:ring-ring"
      />
      {children}
    </label>
  )
}

export default Checkbox
