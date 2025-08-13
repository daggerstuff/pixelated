import React from 'react'

interface ScrollAreaProps {
  children: React.ReactNode
  className?: string
  height?: string | number
  maxHeight?: string | number
}

export const ScrollArea: React.FC<ScrollAreaProps> = ({
  children,
  className = '',
  height,
  maxHeight = '400px'
}) => {
  const style: React.CSSProperties = {}
  
  if (height) {
    style.height = typeof height === 'number' ? `${height}px` : height
  }
  
  if (maxHeight) {
    style.maxHeight = typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight
  }

  return (
    <div 
      className={`overflow-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}

export default ScrollArea
