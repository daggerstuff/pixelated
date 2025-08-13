import React from 'react'

interface CheckboxProps {
  checked?: boolean
  defaultChecked?: boolean
  disabled?: boolean
  id?: string
  name?: string
  value?: string
  onChange?: (checked: boolean) => void
  className?: string
  children?: React.ReactNode
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  defaultChecked = false,
  disabled = false,
  id,
  name,
  value,
  onChange,
  className = '',
  children
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.checked)
  }

  return (
    <label className={`flex items-center cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        id={id}
        name={name}
        value={value}
        onChange={handleChange}
        className="mr-2 h-4 w-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
      />
      {children}
    </label>
  )
}

export default Checkbox
