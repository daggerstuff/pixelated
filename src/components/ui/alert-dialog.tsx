import * as React from 'react'
import { cn } from '~/lib/utils'
import { buttonVariants } from '~/components/ui/button'

interface AlertDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

interface AlertDialogContentProps {
  className?: string
  children: React.ReactNode
}

interface AlertDialogTriggerProps {
  className?: string
  children: React.ReactNode
  onClick?: () => void
}

const AlertDialogContext = React.createContext<{
  open: boolean
  onOpenChange: (open: boolean) => void
}>({ open: false, onOpenChange: () => {} })

function AlertDialog({ open = false, onOpenChange, children }: AlertDialogProps) {
  const [isOpen, setIsOpen] = React.useState(open)

  React.useEffect(() => {
    setIsOpen(open)
  }, [open])

  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    setIsOpen(newOpen)
    onOpenChange?.(newOpen)
  }, [onOpenChange])

  return (
    <AlertDialogContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      {children}
    </AlertDialogContext.Provider>
  )
}

function AlertDialogTrigger({ className, children, onClick, ...props }: AlertDialogTriggerProps) {
  const { onOpenChange } = React.useContext(AlertDialogContext)

  const handleClick = () => {
    onClick?.()
    onOpenChange(true)
  }

  return (
    <button className={className} onClick={handleClick} {...props}>
      {children}
    </button>
  )
}

function AlertDialogPortal({ children }: { children: React.ReactNode }) {
  const { open } = React.useContext(AlertDialogContext)
  
  if (!open) {
    return null
  }
  
  return (
    <div className="fixed inset-0 z-50">
      {children}
    </div>
  )
}

function AlertDialogOverlay({ className, ...props }: React.ComponentProps<'button'>) {
  const { onOpenChange } = React.useContext(AlertDialogContext)
  
  return (
    <button
      type="button"
      className={cn(
        'fixed inset-0 z-50 bg-black/50 animate-in fade-in-0',
        className
      )}
      onClick={() => onOpenChange(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Space') {
          e.preventDefault();
          onOpenChange(false);
        }
      }}
      {...props}
    />
  )
}

function AlertDialogContent({ className, children, ...props }: AlertDialogContentProps) {
  const { open } = React.useContext(AlertDialogContext)
  
  if (!open) {
    return null
  }
  
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <dialog
        className={cn(
          'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg animate-in fade-in-0 zoom-in-95 slide-in-from-left-1/2 slide-in-from-top-[48%]',
          className
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Space') {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        open
        {...props}
      >
        {children}
      </dialog>
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-col space-y-2 text-center sm:text-left',
        className
      )}
      {...props}
    />
  )
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
        className
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({ className, children, ...props }: React.ComponentProps<'h2'>) {
  if (!children) {
    return null; // Don't render empty headings
  }
  return (
    <h2
      className={cn('text-lg font-semibold', className)}
      {...props}
    >
      {children}
    </h2>
  )
}

function AlertDialogDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

function AlertDialogAction({ className, onClick, ...props }: React.ComponentProps<'button'>) {
  const { onOpenChange } = React.useContext(AlertDialogContext)
  
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e)
    onOpenChange(false)
  }
  
  return (
    <button
      className={cn(buttonVariants(), className)}
      onClick={handleClick}
      {...props}
    />
  )
}

function AlertDialogCancel({ className, onClick, ...props }: React.ComponentProps<'button'>) {
  const { onOpenChange } = React.useContext(AlertDialogContext)
  
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e)
    onOpenChange(false)
  }
  
  return (
    <button
      className={cn(
        buttonVariants({ variant: 'outline' }),
        'mt-2 sm:mt-0',
        className
      )}
      onClick={handleClick}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
