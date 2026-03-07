import { Download, Filter, RefreshCw, X } from 'lucide-react'

// Icon props interface
interface IconProps {
  className?: string
  size?: number
  strokeWidth?: number
  'aria-hidden'?: boolean | 'true' | 'false'
}

export const IconRefresh = (props: IconProps) => (
  <RefreshCw
    className={props.className}
    size={props.size}
    strokeWidth={props.strokeWidth}
  />
)

export const IconDownload = (props: IconProps) => (
  <Download
    className={props.className}
    size={props.size}
    strokeWidth={props.strokeWidth}
  />
)

export const IconFilter = (props: IconProps) => (
  <Filter
    className={props.className}
    size={props.size}
    strokeWidth={props.strokeWidth}
  />
)

export const IconX = (props: IconProps) => (
  <X
    className={props.className}
    size={props.size}
    strokeWidth={props.strokeWidth}
    aria-hidden={props['aria-hidden']}
  />
)

// Add more icons as needed
