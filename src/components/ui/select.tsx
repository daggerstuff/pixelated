import * as React from 'react'
import {
  createContext,
  useState,
  useContext,
  useRef,
  useEffect,
  useCallback,
} from 'react'
import type { ReactNode, KeyboardEvent } from 'react'

type SelectContextType = {
  value: string
  setValue: (value: string) => void
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  registerOption: (value: string, label: string) => void
  unregisterOption: (value: string) => void
  options: Array<{ value: string; label: string }>
  triggerRef: React.RefObject<HTMLButtonElement>
  contentRef: React.RefObject<HTMLDivElement>
  selectedLabel: string
  disabled: boolean
}

const SelectContext = createContext<SelectContextType | undefined>(undefined)

function useSelectContext() {
  const context = useContext(SelectContext)
  if (!context) {
    throw new Error('Select components must be used within a Select provider')
  }
  return context
}

export interface SelectProps {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  children: ReactNode
  disabled?: boolean
  className?: string
  placeholder?: string
}

// Main Select container component
export function Select({
  defaultValue,
  value,
  onValueChange,
  children,
  disabled = false,
  className = '',
  placeholder = 'Select an option',
}: SelectProps) {
  // Track registered option values
  const [options, setOptions] = useState<
    Array<{ value: string; label: string }>
  >([])

  // Initialize with controlled value or defaultValue
  const [internalValue, setInternalValue] = useState<string>(
    value !== undefined ? value : defaultValue || '',
  )

  // Dropdown state
  const [isOpen, setIsOpen] = useState(false)

  // Refs for accessibility and click outside detection
  const triggerRef = useRef<HTMLButtonElement>(null!)
  const contentRef = useRef<HTMLDivElement>(null!)

  // If this is a controlled component, use the provided value
  const currentValue = value !== undefined ? value : internalValue

  // Update internal value when controlled value changes
  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value)
    }
  }, [value])

  // Close the dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        contentRef.current &&
        triggerRef.current &&
        !contentRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Set value and call onValueChange if provided
  const setValue = useCallback(
    (newValue: string) => {
      if (value === undefined) {
        setInternalValue(newValue)
      }
      onValueChange?.(newValue)
      setIsOpen(false)
    },
    [onValueChange, value],
  )

  // Register a new option
  const registerOption = useCallback((optionValue: string, label: string) => {
    setOptions((prev) => {
      const exists = prev.some((o) => o.value === optionValue)
      if (!exists) {
        return [...prev, { value: optionValue, label }]
      }
      return prev
    })
  }, [])

  // Unregister an option
  const unregisterOption = useCallback((optionValue: string) => {
    setOptions((prev) => prev.filter((o) => o.value !== optionValue))
  }, [])

  // Get the selected label
  const selectedOption = options.find((o) => o.value === currentValue)
  const selectedLabel = selectedOption?.label || placeholder

  return (
    <SelectContext.Provider
      value={{
        value: currentValue,
        setValue,
        isOpen,
        setIsOpen,
        registerOption,
        unregisterOption,
        options,
        triggerRef,
        contentRef,
        selectedLabel,
        disabled,
      }}
    >
      <div className={`select-container ${className}`}>{children}</div>
    </SelectContext.Provider>
  )
}

// Props for the SelectTrigger component
export interface SelectTriggerProps {
  'children'?: ReactNode
  'className'?: string
  'aria-label'?: string
  'id'?: string
}

// SelectTrigger component - the button that opens the dropdown
export function SelectTrigger({
  children,
  className = '',
  'aria-label': ariaLabel,
}: SelectTriggerProps) {
  const { isOpen, setIsOpen, triggerRef, selectedLabel, disabled } =
    useSelectContext()

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return
    }

    switch (e.key) {
      case 'Enter':
      case ' ':
      case 'ArrowDown':
        e.preventDefault()
        setIsOpen(true)
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        break
    }
  }

  return (
    <button
      type="button"
      role="combobox"
      aria-expanded={isOpen}
      aria-controls="select-listbox"
      aria-label={ariaLabel || 'Select option'}
      className={`select-trigger ${isOpen ? 'select-trigger-open' : ''} ${className}`}
      ref={triggerRef}
      onClick={() => !disabled && setIsOpen(!isOpen)}
      onKeyDown={handleKeyDown}
      disabled={disabled}
    >
      {children || selectedLabel}
      <span className="select-trigger-icon">
        {/* Custom downward chevron icon */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path
            d="M2.5 4.5L6 8L9.5 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </button>
  )
}

// Props for the SelectContent component
export interface SelectContentProps {
  children: ReactNode
  className?: string
  position?: 'popper' | 'item-aligned'
}

// SelectContent component - the dropdown content
export function SelectContent({
  children,
  className = '',
  position = 'popper',
}: SelectContentProps) {
  const { isOpen, contentRef } = useSelectContext()

  if (!isOpen) {
    return null
  }

  return (
    <div
      id="select-listbox"
      className={`select-content ${position === 'popper' ? 'select-content-popper' : 'select-content-item-aligned'} ${className}`}
      ref={contentRef}
      role="listbox"
    >
      {children}
    </div>
  )
}

// Props for the SelectItem component
export interface SelectItemProps extends React.ComponentPropsWithoutRef<'div'> {
  value: string
  children: ReactNode
  className?: string
  disabled?: boolean
}

// SelectItem component - a selectable option in the dropdown
export function SelectItem({
  value,
  children,
  className = '',
  disabled = false,
  ...props
}: SelectItemProps) {
  const {
    value: selectedValue,
    setValue,
    registerOption,
    unregisterOption,
  } = useSelectContext()

  // Register/unregister this option on mount/unmount
  useEffect(() => {
    registerOption(value, children as string)
    return () => unregisterOption(value)
  }, [value, children, registerOption, unregisterOption])

  // Determine if this option is currently selected
  const isSelected = selectedValue === value

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) {
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setValue(value)
    }
  }

  return (
    <div
      role="option"
      aria-selected={isSelected}
      className={`select-item ${isSelected ? 'select-item-selected' : ''} ${disabled ? 'select-item-disabled' : ''} ${className}`}
      onClick={() => !disabled && setValue(value)}
      onKeyDown={handleKeyDown}
      data-value={value}
      data-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      {...props}
    >
      {children}
      {isSelected && (
        <span className="select-item-check">
          {/* Custom check icon */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2.5 6L5 8.5L9.5 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
    </div>
  )
}

// Props for the SelectGroup component
export interface SelectGroupProps {
  children: ReactNode
  className?: string
}

// SelectGroup component - a group of related options
export function SelectGroup({ children, className = '' }: SelectGroupProps) {
  return (
    <div className={`select-group ${className}`} role="group">
      {children}
    </div>
  )
}

// Props for the SelectLabel component
export interface SelectLabelProps {
  children: ReactNode
  className?: string
}

// SelectLabel component - a label for a group of options
export function SelectLabel({ children, className = '' }: SelectLabelProps) {
  return <div className={`select-label ${className}`}>{children}</div>
}

// A simple select component that only has a dropdown trigger and a list of options
export interface SimpleSelectProps {
  options: Array<{ value: string; label: string }>
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  label?: string
}

export function SimpleSelect({
  options,
  value,
  defaultValue,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  className = '',
  label,
}: SimpleSelectProps) {
  const selectProps: SelectProps = {
    children: (
      <>
        <SelectTrigger />
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </>
    ),
    disabled,
    placeholder,
  }

  if (value !== undefined) {
    selectProps.value = value
  }
  if (defaultValue !== undefined) {
    selectProps.defaultValue = defaultValue
  }
  if (onChange !== undefined) {
    selectProps.onValueChange = onChange
  }

  return (
    <div className={`simple-select ${className}`}>
      {label && <label className="simple-select-label">{label}</label>}
      <Select {...selectProps} />
    </div>
  )
}

// SelectValue component - displays the selected value
export interface SelectValueProps {
  className?: string
}

export function SelectValue({ className = '' }: SelectValueProps) {
  const { selectedLabel } = useSelectContext()

  return <span className={`select-value ${className}`}>{selectedLabel}</span>
}
