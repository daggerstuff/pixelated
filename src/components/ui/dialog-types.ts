import type { ReactNode } from 'react'

// Dialog Context Types
export interface DialogContextType {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Base Dialog Props
export interface DialogRootProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}

// Dialog Component Props
export interface DialogProps<TData = unknown> {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Function to call when the dialog is closed */
  onClose: () => void
  /** Dialog title */
  title?: ReactNode
  /** Dialog description/content */
  children: ReactNode
  /** Footer content */
  footer?: ReactNode
  /** Whether to show a close button in the header */
  showCloseButton?: boolean
  /** Additional className for the dialog */
  className?: string
  /** Additional className for the backdrop */
  backdropClassName?: string
  /** Maximum width of the dialog */
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full'
  /** Whether to close when clicking outside */
  closeOnOutsideClick?: boolean
  /** Whether to close when pressing escape */
  closeOnEsc?: boolean
  /** Custom data passed to the dialog */
  data?: TData
}

// Confirm Dialog Props
export interface ConfirmDialogProps<TData = unknown>
  extends Omit<DialogProps<TData>, 'footer' | 'children'> {
  /** Message to show in the dialog */
  message: ReactNode
  /** Confirm button text */
  confirmText?: string
  /** Cancel button text */
  cancelText?: string
  /** Confirm button variant */
  confirmVariant?: 'primary' | 'danger'
  /** Function to call when confirmed */
  onConfirm: () => void | Promise<void>
  /** Dialog content */
  children?: ReactNode
  /** Additional props for the confirm button */
  confirmButtonProps?: Record<string, unknown>
  /** Additional props for the cancel button */
  cancelButtonProps?: Record<string, unknown>
  /** Whether this is a dangerous action */
  isDanger?: boolean
  /** Whether the dialog is in loading state */
  loading?: boolean
}

// Dialog Hook Return Types
export interface DialogHookResult {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export interface ConfirmDialogHookResult<TData = unknown> {
  isOpen: boolean
  confirm: (props: Omit<ConfirmDialogProps<TData>, 'isOpen' | 'onClose'>) => Promise<boolean>
  close: () => void
  confirmProps: Omit<ConfirmDialogProps<TData>, 'isOpen' | 'onClose'>
}

// Max Width Type
export type DialogMaxWidth = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full'

// Max Width Classes Map
export const maxWidthClasses: Record<DialogMaxWidth, string> = {
  xs: 'max-w-xs',
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-full',
}
