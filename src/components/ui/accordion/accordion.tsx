import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../../lib/utils'

interface AccordionProps {
  type?: 'single' | 'multiple'
  collapsible?: boolean
  className?: string
  children: React.ReactNode
}

interface AccordionItemProps {
  value: string
  className?: string
  children: React.ReactNode
}

interface AccordionTriggerProps {
  className?: string
  children: React.ReactNode
}

interface AccordionContentProps {
  className?: string
  children: React.ReactNode
}

const AccordionContext = React.createContext<{
  openItems: string[]
  toggleItem: (value: string) => void
  type: 'single' | 'multiple'
}>({ openItems: [], toggleItem: () => { }, type: 'single' })

const AccordionItemContext = React.createContext<{
  value: string
  isOpen: boolean
}>({ value: '', isOpen: false })

const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  (
    { className, children, type = 'single', collapsible = false, ...props },
    ref,
  ) => {
    const [openItems, setOpenItems] = React.useState<string[]>([])

    const toggleItem = React.useCallback(
      (value: string) => {
        setOpenItems((prev) => {
          if (type === 'single') {
            if (prev.includes(value)) {
              return collapsible ? [] : prev
            }
            return [value]
          } else {
            return prev.includes(value)
              ? prev.filter((item) => item !== value)
              : [...prev, value]
          }
        })
      },
      [type, collapsible],
    )

    return (
      <AccordionContext.Provider value={{ openItems, toggleItem, type }}>
        <div ref={ref} className={cn('w-full', className)} {...props}>
          {children}
        </div>
      </AccordionContext.Provider>
    )
  },
)
Accordion.displayName = 'Accordion'

const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ className, value, children, ...props }, ref) => {
    const { openItems } = React.useContext(AccordionContext)
    const isOpen = openItems.includes(value)

    return (
      <AccordionItemContext.Provider value={{ value, isOpen }}>
        <div ref={ref} className={cn('border-b', className)} {...props}>
          {children}
        </div>
      </AccordionItemContext.Provider>
    )
  },
)
AccordionItem.displayName = 'AccordionItem'

const AccordionTrigger = React.forwardRef<
  HTMLButtonElement,
  AccordionTriggerProps
>(({ className, children, ...props }, ref) => {
  const { toggleItem } = React.useContext(AccordionContext)
  const { value, isOpen } = React.useContext(AccordionItemContext)
  const id = React.useId()
  const contentId = `accordion-content-${id}`
  const triggerId = `accordion-trigger-${id}`

  // Pass IDs down via context or props if possible, but for now we'll recreate them in Content if needed
  // A better pattern would be to generate ID in Item and pass down.
  // Simplifying for this specific refactor to keep it contained.

  return (
    <AccordionItemContext.Provider value={{ value, isOpen, contentId, triggerId } as any}>
      <button
        ref={ref}
        id={triggerId}
        className={cn(
          'flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline text-left w-full',
          className,
        )}
        onClick={() => toggleItem(value)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        {...props}
      >
        {children}
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      </button>
    </AccordionItemContext.Provider>
  )
})
AccordionTrigger.displayName = 'AccordionTrigger'

const AccordionContent = React.forwardRef<
  HTMLDivElement,
  AccordionContentProps
>(({ className, children, ...props }, ref) => {
  const { isOpen, contentId, triggerId } = React.useContext(AccordionItemContext) as any

  return (
    <div
      ref={ref}
      id={contentId}
      role="region"
      aria-labelledby={triggerId}
      className={cn(
        'overflow-hidden text-sm transition-all duration-200',
        isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0',
      )}
      {...props}
    >
      <div className={cn('pb-4 pt-0', className)}>{children}</div>
    </div>
  )
})
AccordionContent.displayName = 'AccordionContent'

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
