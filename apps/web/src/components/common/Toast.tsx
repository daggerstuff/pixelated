import { Toast as ToastComponent, toast } from '../ui/toast'

export { toast }

/**
 * Toast container component that provides toast notifications functionality.
 */
export function ToastContainer() {
  return (
    <ToastComponent
      position="bottom-right"
      toastOptions={{
        duration: 5000,
        style: {
          borderRadius: '0.5rem',
          padding: '1rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        },
      }}
    />
  )
}

export default ToastContainer
