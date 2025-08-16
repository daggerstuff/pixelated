import React, { useState, useContext, createContext } from 'react'

interface PopoverContextType {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

const PopoverContext = createContext<PopoverContextType | null>(null)

interface PopoverProps {
  trigger?: React.ReactNode
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

interface PopoverTriggerProps {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}

interface PopoverContentProps {
  children: React.ReactNode
  className?: string
}

export const Popover: React.FC<PopoverProps> = ({ 
  trigger, 
  children, 
  open, 
  onOpenChange,
  className = '' 
}) => {
  const [isOpen, setIsOpen] = useState(open || false)
  
  const handleToggle = () => {
    const newOpen = !isOpen
    setIsOpen(newOpen)
    onOpenChange?.(newOpen)
  }

  // If trigger prop is provided, use the simple API
  if (trigger) {
    return (
      <div className={`relative ${className}`}>
        <button
          type="button"
          onClick={handleToggle}
          className=""
          aria-label="Toggle popover"
        >
          {trigger}
        </button>
        {isOpen && (
          <div className="absolute z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-2 text-popover-foreground shadow-md animate-in data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2">
            {children}
          </div>
        )}
      </div>
    )
  }

  // Otherwise, use compound component API
  return (
    <PopoverContext.Provider value={{ isOpen, setIsOpen }}>
      <div className={`relative ${className}`}>
        {children}
      </div>
    </PopoverContext.Provider>
  )
}

export const PopoverTrigger: React.FC<PopoverTriggerProps> = ({ 
  children, 
  onClick,
  className = '' 
}) => {
  const context = useContext(PopoverContext)
  
  const handleClick = () => {
    context?.setIsOpen(!context.isOpen)
    onClick?.()
  }

  return (
    <button onClick={handleClick} className={className}>
      {children}
    </button>
  )
}

export const PopoverContent: React.FC<PopoverContentProps> = ({ 
  children, 
  className = '' 
}) => {
  const context = useContext(PopoverContext)
  
  if (!context?.isOpen) return null

  return (
    <div className={`absolute z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-2 text-popover-foreground shadow-md animate-in data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ${className}`}>
      {children}
    </div>
  )
}

export default Popover
