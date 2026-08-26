import { type CSSProperties, type ReactElement, type ReactNode } from 'react'

interface ScrollAreaProps {
  children: ReactNode
  className?: string
  height?: string | number
  maxHeight?: string | number
}

export const ScrollArea = ({
  children,
  className = '',
  height,
  maxHeight = '400px',
}: ScrollAreaProps): ReactElement => {
  const style: CSSProperties = {}

  if (height) {
    style.height = typeof height === 'number' ? `${height}px` : height
  }

  if (maxHeight) {
    style.maxHeight =
      typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight
  }

  return (
    <div
      className={`scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 overflow-auto ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}

export default ScrollArea
