import React from 'react'

type MotionProps = {
  initial?: unknown
  animate?: unknown
  exit?: unknown
  transition?: unknown
  variants?: unknown
  whileHover?: unknown
  whileTap?: unknown
  whileFocus?: unknown
  whileInView?: unknown
  viewport?: unknown
  layout?: unknown
  layoutId?: unknown
  onAnimationStart?: unknown
  onAnimationComplete?: unknown
}

type MotionComponentMap = Record<string, React.ComponentType<any>>

export function AnimatePresence(props: {
  children?: React.ReactNode
}): React.JSX.Element {
  return <>{props.children}</>
}

function createMotionComponent(tag: string) {
  const Component = React.forwardRef<
    unknown,
    React.ComponentPropsWithoutRef<any> & MotionProps
  >((props, ref) => {
    const {
      initial,
      animate,
      exit,
      transition,
      variants,
      whileHover,
      whileTap,
      whileFocus,
      whileInView,
      viewport,
      layout,
      layoutId,
      onAnimationStart,
      onAnimationComplete,
      ...rest
    } = props

    return React.createElement(tag, { ...rest, ref })
  })

  Component.displayName = `motion.${tag}`
  return Component
}

export const motion: MotionComponentMap = new Proxy(
  {},
  {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined
      return createMotionComponent(prop)
    },
  },
)
