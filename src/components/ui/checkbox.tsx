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
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.checked)
  }

  return (
    <label
      className={`flex cursor-pointer items-center ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`}
    >
      <input
        type='checkbox'
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        id={id}
        name={name}
        value={value}
        onChange={handleChange}
        className='text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 mr-2 h-4 w-4 rounded focus:ring-2'
      />
      {children}
    </label>
  )
}

export default Checkbox
