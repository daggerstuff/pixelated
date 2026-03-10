import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  useEffect,
} from 'react'
import type { ReactNode } from 'react'

// Define the TabsContext to manage tab state
type TabsContextType = {
  activeValue: string
  setActiveValue: (value: string) => void
  registerTab: (value: string) => void
  unregisterTab: (value: string) => void
  tabValues: string[]
}

const TabsContext = createContext<TabsContextType | undefined>(undefined)

// Hook to access the tabs context
function useTabsContext() {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider')
  }
  return context
}

// Props for the Tabs component
export interface TabsProps {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  children: ReactNode
  className?: string
}

// Main Tabs container component
export function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className = '',
}: TabsProps) {
  // Track registered tab values
  const [tabValues, setTabValues] = useState<string[]>([])

  // Initialize with controlled value, defaultValue, or first registered tab
  const [internalValue, setInternalValue] = useState<string>(
    value || defaultValue || '',
  )

  // If this is a controlled component, use the provided value
  const activeValue = value !== undefined ? value : internalValue

  // Update internal value when controlled value changes
  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value)
    }
  }, [value])

  // Set active value and call onValueChange if provided
  const setActiveValue = useCallback(
    (newValue: string) => {
      if (value === undefined) {
        setInternalValue(newValue)
      }
      onValueChange?.(newValue)
    },
    [onValueChange, value],
  )

  // Register a new tab value
  const registerTab = useCallback(
    (tabValue: string) => {
      setTabValues((prev) => {
        if (!prev.includes(tabValue)) {
          return [...prev, tabValue]
        }
        return prev
      })

      // If no active value is set yet, use the first registered tab
      if (!activeValue && tabValue) {
        setActiveValue(tabValue)
      }
    },
    [activeValue, setActiveValue],
  )

  // Unregister a tab value
  const unregisterTab = useCallback((tabValue: string) => {
    setTabValues((prev) => prev.filter((v) => v !== tabValue))
  }, [])

  return (
    <TabsContext.Provider
      value={{
        activeValue,
        setActiveValue,
        registerTab,
        unregisterTab,
        tabValues,
      }}
    >
      <div className={`tabs ${className}`}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

// Props for the TabsList component
export interface TabsListProps {
  children: ReactNode
  className?: string
}

// TabsList component - container for tab triggers
export function TabsList({ children, className = '' }: TabsListProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const list = e.currentTarget
    const tabs = Array.from(
      list.querySelectorAll('[role="tab"]:not([disabled])'),
    ) as HTMLElement[]
    const index = tabs.indexOf(document.activeElement as HTMLElement)

    if (index < 0) return

    let nextIndex = index

    switch (e.key) {
      case 'ArrowRight':
        nextIndex = (index + 1) % tabs.length
        break
      case 'ArrowLeft':
        nextIndex = (index - 1 + tabs.length) % tabs.length
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = tabs.length - 1
        break
      default:
        return
    }

    e.preventDefault()
    tabs[nextIndex].focus()
    tabs[nextIndex].click()
  }

  return (
    <div
      className={`tabs-list ${className}`}
      role="tablist"
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  )
}

// Props for the TabsTrigger component
export interface TabsTriggerProps {
  value: string
  children: ReactNode
  className?: string
  disabled?: boolean
}

// TabsTrigger component - the clickable tab button
export function TabsTrigger({
  value,
  children,
  className = '',
  disabled = false,
}: TabsTriggerProps) {
  const { activeValue, setActiveValue, registerTab, unregisterTab } =
    useTabsContext()

  // Register/unregister this tab on mount/unmount
  useEffect(() => {
    registerTab(value)
    return () => unregisterTab(value)
  }, [value, registerTab, unregisterTab])

  // Determine if this tab is currently active
  const isActive = activeValue === value

  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      aria-controls={`tabpanel-${value}`}
      id={`tab-${value}`}
      tabIndex={isActive ? 0 : -1}
      className={`tabs-trigger ${isActive ? 'tabs-trigger-active' : ''} ${className}`}
      onClick={() => !disabled && setActiveValue(value)}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

// Props for the TabsContent component
export interface TabsContentProps {
  value: string
  children: ReactNode
  className?: string
  forceMount?: boolean
}

// TabsContent component - the content panel for each tab
export function TabsContent({
  value,
  children,
  className = '',
  forceMount = false,
}: TabsContentProps) {
  const { activeValue } = useTabsContext()

  // Only render if this tab is active or forceMount is true
  if (!forceMount && activeValue !== value) {
    return null
  }

  return (
    <div
      role="tabpanel"
      aria-labelledby={`tab-${value}`}
      id={`tabpanel-${value}`}
      hidden={activeValue !== value}
      className={`tabs-content ${className}`}
      tabIndex={0}
    >
      {children}
    </div>
  )
}
