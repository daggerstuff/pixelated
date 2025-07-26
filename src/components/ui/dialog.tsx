import React, { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './button'
import FocusTrap from '../accessibility/FocusTrap'
import type {
  DialogContextType,
  DialogRootProps,
  DialogProps,
  ConfirmDialogProps,
  DialogHookResult,
  ConfirmDialogHookResult,
  DialogMaxWidth,
  } from './dialog-types'
import { maxWidthClasses } from './dialog-types'

// Custom Dialog Context
const DialogContext = React.createContext<DialogContextType>({
  open: false,
  onOpenChange: () => undefined,
})

// Shadcn/UI Dialog Components
const Dialog = ({ open = false, onOpenChange, children }: DialogRootProps) => {
  const [isOpen, setIsOpen] = useState(open)

  useEffect(() => {
    setIsOpen(open)
  }, [open])

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      setIsOpen(newOpen)
      onOpenChange?.(newOpen)
    },
    [onOpenChange],
  )

  return (
    <DialogContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  )
}

interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

const DialogTrigger = React.forwardRef<HTMLButtonElement, DialogTriggerProps>(
  ({ children, ...props }, ref) => {
    const { onOpenChange } = React.useContext(DialogContext)

    return (
      <button ref={ref} onClick={() => onOpenChange(true)} {...props}>
        {children}
      </button>
    )
  },
)
DialogTrigger.displayName = 'DialogTrigger'

const DialogPortal = ({ children }: { children: React.ReactNode }) => {
  const { open } = React.useContext(DialogContext)

  if (!open) {
    return null
  }

  return <div className="fixed inset-0 z-50">{children}</div>
}

interface DialogOverlayProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string
}

const DialogOverlay = React.forwardRef<HTMLButtonElement, DialogOverlayProps>(
  ({ className, ...props }, ref) => {
    const { onOpenChange } = React.useContext(DialogContext)

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onOpenChange(false)
      }
    }

    return (
      <button
        ref={ref}
        className={cn(
          'fixed inset-0 z-50 bg-background/80 backdrop-blur-sm animate-in fade-in-0 border-0 p-0',
          className,
        )}
        onClick={() => onOpenChange(false)}
        onKeyDown={handleKeyDown}
        aria-label="Close dialog"
        {...props}
      />
    )
  },
)
DialogOverlay.displayName = 'DialogOverlay'

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  children: React.ReactNode
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, ...props }, ref) => {
    const { open, onOpenChange } = React.useContext(DialogContext)

    if (!open) {
      return null
    }

  return (
    <DialogPortal>
      <DialogOverlay />
      <div
        ref={ref}
        className={cn(
          'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 animate-in fade-in-0 zoom-in-95 slide-in-from-left-1/2 slide-in-from-top-[48%] sm:rounded-lg',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        {...props}
      >
        {children}
        <button
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          onClick={() => onOpenChange(false)}
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </DialogPortal>
  )
})
DialogContent.displayName = 'DialogContent'

interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

const DialogHeader = React.forwardRef<HTMLDivElement, DialogHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col space-y-1.5 text-center sm:text-left',
        className,
      )}
      {...props}
    />
  ),
)
DialogHeader.displayName = 'DialogHeader'

interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

const DialogFooter = React.forwardRef<HTMLDivElement, DialogFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
        className,
      )}
      {...props}
    />
  ),
)
DialogFooter.displayName = 'DialogFooter'

interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  className?: string
  children?: React.ReactNode
}

const DialogTitle = React.forwardRef<HTMLHeadingElement, DialogTitleProps>(
  ({ className, children, ...props }, ref) => {
    if (!children) {
      return null
    }
    return (
      <h2
        ref={ref}
        className={cn(
          'text-lg font-semibold leading-none tracking-tight',
          className,
        )}
        {...props}
      >
        {children}
      </h2>
    )
  },
)
DialogTitle.displayName = 'DialogTitle'

interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  className?: string
}

const DialogDescription = React.forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  ),
)
DialogDescription.displayName = 'DialogDescription'

function DialogModal<TData>({
  isOpen,
  onClose,
  title,
  children,
  footer,
  showCloseButton = true,
  className = '',
  backdropClassName = '',
  maxWidth = 'md',
  closeOnOutsideClick = true,
  closeOnEsc = true,
}: DialogProps<TData>) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (isOpen && closeOnEsc && e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose, closeOnEsc])

  // Prevent body scrolling when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Handle outside click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (closeOnOutsideClick && e.target === e.currentTarget) {
        onClose()
      }
    },
    [closeOnOutsideClick, onClose],
  )

  if (!isOpen) {
    return null
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4',
        backdropClassName,
      )}
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleBackdropClick(e as unknown as React.MouseEvent<HTMLDivElement>)
        }
      }}
      tabIndex={-1}
      aria-modal="true"
      role="dialog"
    >
      <FocusTrap active={isOpen}>
        <div
          className={cn(
            'w-full rounded-lg bg-white shadow-lg dark:bg-gray-800',
            'overflow-hidden flex flex-col',
            maxWidthClasses[maxWidth as DialogMaxWidth],
            className,
          )}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation()
            }
          }}
          tabIndex={-1}
        >
          {/* Header */}
          {title && (
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {title}
              </h3>
              {showCloseButton && (
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none"
                  onClick={onClose}
                  aria-label="Close dialog"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
              {footer}
            </div>
          )}
        </div>
      </FocusTrap>
    </div>
  )
}

function ConfirmDialog<TData>({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmButtonProps = {},
  cancelButtonProps = {},
  isDanger = false,
  loading = false,
  className = '',
  backdropClassName = '',
  maxWidth = 'sm',
  closeOnOutsideClick = true,
}: ConfirmDialogProps<TData>) {
  const [isConfirming, setIsConfirming] = useState(false)

  const handleConfirm = useCallback(async () => {
    setIsConfirming(true)
    try {
      await onConfirm()
    } catch (error) {
      console.error('Error in confirmation handler:', error)
    } finally {
      setIsConfirming(false)
      onClose()
    }
  }, [onConfirm, onClose])

  if (!isOpen) {
    return null
  }

  const isLoading = loading || isConfirming

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4',
        backdropClassName,
      )}
      onClick={
        !closeOnOutsideClick || isLoading
          ? (e) => e.stopPropagation()
          : onClose
      }
      onKeyDown={(e) => {
        if (
          (e.key === 'Enter' || e.key === ' ') &&
          !(!closeOnOutsideClick || isLoading)
        ) {
          e.preventDefault()
          onClose()
        }
      }}
      tabIndex={-1}
      aria-modal="true"
      role="alertdialog"
    >
      <FocusTrap active={isOpen}>
        <div
          className={cn(
            'w-full rounded-lg bg-white shadow-lg dark:bg-gray-800',
            'overflow-hidden flex flex-col',
            maxWidth === 'sm' ? 'max-w-sm' : 'max-w-md',
            className,
          )}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation()
            }
          }}
          tabIndex={-1}
        >
          {/* Header */}
          {title && (
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {title}
              </h3>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">{children}</div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              {...cancelButtonProps}
            >
              {cancelText}
            </Button>
            <Button
              variant={isDanger ? 'destructive' : 'default'}
              onClick={handleConfirm}
              disabled={isLoading}
              {...confirmButtonProps}
            >
              {isLoading && (
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              {confirmText}
            </Button>
          </div>
        </div>
      </FocusTrap>
    </div>
  )
}

/**
 * Custom hook for using a dialog
 */
function useDialog(initialState = false): DialogHookResult {
  const [isOpen, setIsOpen] = useState(initialState)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

  return { isOpen, open, close, toggle }
}

/**
 * Custom hook for using a confirm dialog
 */
function useConfirmDialog<TData>(): ConfirmDialogHookResult<TData> {
  const [isOpen, setIsOpen] = useState(false)
  const [confirmProps, setConfirmProps] = useState<
    Omit<ConfirmDialogProps<TData>, 'isOpen' | 'onClose'>
  >({
    title: 'Confirm',
    message: '',
    onConfirm: () => Promise.resolve(),
  })

  const confirm = useCallback(
    (props: Omit<ConfirmDialogProps<TData>, 'isOpen' | 'onClose'>) => {
      setConfirmProps(props)
      setIsOpen(true)

      return new Promise<boolean>((resolve) => {
        setConfirmProps({
          ...props,
          onConfirm: async () => {
            if (props.onConfirm) {
              await props.onConfirm()
            }
            resolve(true)
          },
        })
      })
    },
    [],
  )

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  return {
    isOpen,
    confirm,
    close,
    confirmProps,
  }
}

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogModal,
  ConfirmDialog,
  useDialog,
  useConfirmDialog,
}
