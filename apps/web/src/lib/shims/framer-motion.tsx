import React from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  onViewportEnter?: unknown
  viewport?: unknown
  layout?: unknown
  layoutId?: unknown
  custom?: unknown
  onAnimationStart?: unknown
  onAnimationComplete?: unknown
}

type MotionComponentMap = Record<string, React.ComponentType<any>>

// ---------------------------------------------------------------------------
// AnimatePresence
// ---------------------------------------------------------------------------

export function AnimatePresence(props: {
  children?: React.ReactNode
  mode?: string
  initial?: boolean
  onExitComplete?: () => void
}): React.JSX.Element {
  return <>{props.children}</>
}

// ---------------------------------------------------------------------------
// motion proxy
// ---------------------------------------------------------------------------

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
      onViewportEnter,
      viewport,
      layout,
      layoutId,
      custom,
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

// ---------------------------------------------------------------------------
// useAnimation — returns an animation controls object
// ---------------------------------------------------------------------------

export interface AnimationControls {
  start: (definition: unknown, options?: unknown) => Promise<void>
  stop: () => void
  set: (definition: unknown) => void
  mount: () => () => void
}

export function useAnimation(): AnimationControls {
  return React.useMemo(
    () => ({
      start: async (_definition: unknown, _options?: unknown) => {},
      stop: () => {},
      set: (_definition: unknown) => {},
      mount: () => () => {},
    }),
    [],
  )
}

// ---------------------------------------------------------------------------
// useMotionValue / useTransform / useSpring stubs
// ---------------------------------------------------------------------------

export interface MotionValue<T = unknown> {
  get: () => T
  set: (value: T) => void
  onChange: (cb: (value: T) => void) => () => void
}

export function useMotionValue<T>(initial: T): MotionValue<T> {
  const ref = React.useRef(initial)
  return React.useMemo(
    () => ({
      get: () => ref.current,
      set: (v: T) => {
        ref.current = v
      },
      onChange: (_cb: (v: T) => void) => () => {},
    }),
    [],
  )
}

export function useTransform<T, V = unknown>(
  _value: MotionValue<V>,
  _inputRange: number[],
  outputRange: T[],
): MotionValue<T> {
  // The output range should always have at least one element; use the first
  // entry as the static initial value for this stub implementation.
  const initial: T = outputRange[0]
  return useMotionValue(initial)
}

export function useSpring(
  value: MotionValue<number> | number,
  _config?: unknown,
): MotionValue<number> {
  const initial = typeof value === 'number' ? value : value.get()
  return useMotionValue(initial)
}

// ---------------------------------------------------------------------------
// useScroll stub
// ---------------------------------------------------------------------------

export function useScroll(_options?: unknown): {
  scrollX: MotionValue<number>
  scrollY: MotionValue<number>
  scrollXProgress: MotionValue<number>
  scrollYProgress: MotionValue<number>
} {
  return {
    scrollX: useMotionValue(0),
    scrollY: useMotionValue(0),
    scrollXProgress: useMotionValue(0),
    scrollYProgress: useMotionValue(0),
  }
}

// ---------------------------------------------------------------------------
// useInView stub
// ---------------------------------------------------------------------------

export function useInView(
  _ref?: React.RefObject<Element>,
  _options?: unknown,
): boolean {
  return false
}
