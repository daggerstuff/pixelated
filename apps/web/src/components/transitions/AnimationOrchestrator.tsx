import {
  AnimatePresence,
  motion,
  useAnimation,
  type Variants,
} from 'framer-motion'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import {
  animationPresets,
  getReducedMotionVariant,
  type AnimationPreset,
  type SequenceType,
  TIMING,
  EASING,
} from '../../lib/animations/sequences'

export interface AnimationOrchestratorProps {
  children: React.ReactNode
  sequence?: AnimationPreset | Variants
  orchestrationType?: SequenceType
  triggerOnMount?: boolean
  triggerOnViewport?: boolean
  viewportThreshold?: number
  staggerChildren?: boolean
  staggerDelay?: number
  enableReducedMotion?: boolean
  onAnimationStart?: () => void
  onAnimationComplete?: () => void
  className?: string
  style?: React.CSSProperties
  as?: keyof React.JSX.IntrinsicElements
  viewport?: boolean
  once?: boolean
}

// Hook for reduced motion detection
function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const timer = window.setTimeout(() => {
      setPrefersReducedMotion(mediaQuery.matches)
    }, 0)

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => {
      window.clearTimeout(timer)
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  return prefersReducedMotion
}

// Main AnimationOrchestrator component
export function AnimationOrchestrator({
  children,
  sequence = 'fadeIn',
  triggerOnMount = true,
  triggerOnViewport = false,
  viewportThreshold = 0.1,
  staggerChildren = false,
  staggerDelay = 0.1,
  enableReducedMotion = true,
  onAnimationStart,
  onAnimationComplete,
  className = '',
  style = {},
  as: _as = 'div',
  once = true,
}: AnimationOrchestratorProps) {
  const controls = useAnimation()
  const prefersReducedMotion = useReducedMotion()
  const [isVisible, setIsVisible] = useState(!triggerOnViewport)

  // Get the animation variants
  const variants = useMemo(() => {
    let baseVariants: Variants
    const isPreset = (value: string): value is AnimationPreset =>
      value in animationPresets

    const getPreset = (presetName: AnimationPreset): Variants => {
      return animationPresets[presetName]
    }

    if (typeof sequence === 'string') {
      if (isPreset(sequence)) {
        baseVariants = getPreset(sequence)
      } else {
        baseVariants = animationPresets.fadeIn
      }
    } else {
      baseVariants = sequence
    }

    // Apply reduced motion if enabled and user prefers it
    if (enableReducedMotion && prefersReducedMotion) {
      return getReducedMotionVariant(baseVariants)
    }

    // Add stagger configuration if enabled
    if (
      staggerChildren &&
      baseVariants['animate'] &&
      typeof baseVariants['animate'] === 'object'
    ) {
      const baseAnimate = baseVariants['animate']
      return {
        ...baseVariants,
        animate: {
          ...baseAnimate,
          transition: {
            ...(baseAnimate.transition ?? {}),
            staggerChildren: staggerDelay,
          },
        },
      }
    }

    return baseVariants
  }, [
    sequence,
    enableReducedMotion,
    prefersReducedMotion,
    staggerChildren,
    staggerDelay,
  ])

  // Handle viewport trigger
  const handleViewportEnter = useCallback(() => {
    if (triggerOnViewport && !isVisible) {
      setIsVisible(true)
      void controls.start('animate')
      onAnimationStart?.()
    }
  }, [triggerOnViewport, isVisible, controls, onAnimationStart])

  // Handle mount trigger
  useEffect(() => {
    if (triggerOnMount && !triggerOnViewport) {
      void controls.start('animate')
      onAnimationStart?.()
    }
  }, [triggerOnMount, triggerOnViewport, controls, onAnimationStart])

  // Handle animation complete
  const handleAnimationComplete = useCallback(() => {
    onAnimationComplete?.()
  }, [onAnimationComplete])

  return (
    <motion.div
      className={className}
      style={style}
      variants={variants}
      initial="initial"
      animate={controls}
      exit="exit"
      onAnimationComplete={handleAnimationComplete}
      onViewportEnter={triggerOnViewport ? handleViewportEnter : undefined}
      viewport={
        triggerOnViewport
          ? {
              once,
              margin: '0px 0px -10% 0px',
              amount: viewportThreshold,
            }
          : undefined
      }
    >
      {children}
    </motion.div>
  )
}

// Specialized components for common use cases

export function PageTransition({
  children,
  sequence = 'fadeIn',
  className = '',
  ...props
}: Omit<AnimationOrchestratorProps, 'orchestrationType'>) {
  return (
    <AnimationOrchestrator
      sequence={sequence}
      orchestrationType="page"
      className={className}
      {...props}
    >
      {children}
    </AnimationOrchestrator>
  )
}

export function ListAnimation({
  children,
  sequence = 'stagger',
  staggerChildren = true,
  staggerDelay = 0.1,
  triggerOnViewport = true,
  className = '',
  ...props
}: Omit<AnimationOrchestratorProps, 'orchestrationType'>) {
  return (
    <AnimationOrchestrator
      sequence={sequence}
      orchestrationType="list"
      staggerChildren={staggerChildren}
      staggerDelay={staggerDelay}
      triggerOnViewport={triggerOnViewport}
      className={className}
      {...props}
    >
      {children}
    </AnimationOrchestrator>
  )
}

export function ModalAnimation({
  children,
  sequence = 'modal',
  triggerOnMount = true,
  className = '',
  ...props
}: Omit<AnimationOrchestratorProps, 'orchestrationType'>) {
  return (
    <AnimationOrchestrator
      sequence={sequence}
      orchestrationType="modal"
      triggerOnMount={triggerOnMount}
      className={className}
      {...props}
    >
      {children}
    </AnimationOrchestrator>
  )
}

export function InteractiveAnimation({
  children,
  sequence = 'button',
  triggerOnMount = false,
  className = '',
  ...props
}: Omit<AnimationOrchestratorProps, 'orchestrationType'>) {
  return (
    <AnimationOrchestrator
      sequence={sequence}
      orchestrationType="interactive"
      triggerOnMount={triggerOnMount}
      className={className}
      {...props}
    >
      {children}
    </AnimationOrchestrator>
  )
}

// Advanced sequence builder for complex animations
interface SequenceStep {
  delay?: number
  duration?: number
  ease?: keyof typeof EASING | number[]
  variants: Variants
}

interface AdvancedSequenceProps {
  children: React.ReactNode
  steps: SequenceStep[]
  autoPlay?: boolean
  loop?: boolean
  className?: string
  onSequenceComplete?: () => void
}

export function AdvancedSequence({
  children,
  steps,
  autoPlay = true,
  loop = false,
  className = '',
  onSequenceComplete,
}: AdvancedSequenceProps) {
  const controls = useAnimation()
  const [, setCurrentStep] = useState(0)

  // Execute sequence
  const executeSequence = useCallback(async function executeSequence() {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      if (!step) {
        continue
      }

      const animateStep = step.variants['animate']
      setCurrentStep(i)
      await controls.start(animateStep ?? 'animate')
      await new Promise((resolve) =>
        setTimeout(resolve, (step.duration ?? TIMING.normal) * 1000),
      )
    }

    onSequenceComplete?.()

    if (loop) {
      setCurrentStep(0)
      if (steps[0]) {
        await controls.start(steps[0].variants['initial'] ?? 'initial')
      }
      void executeSequence()
    }
  }, [steps, controls, loop, onSequenceComplete])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (autoPlay && steps.length > 0) {
        void executeSequence()
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [autoPlay, executeSequence, steps.length])

  return (
    <motion.div className={className} initial="initial" animate={controls}>
      {children}
    </motion.div>
  )
}

// Choreographed animation for multiple elements
interface ChoreographyItem {
  id: string
  element: React.ReactNode
  variants: Variants
  delay?: number
}

interface ChoreographyProps {
  items: ChoreographyItem[]
  masterSequence?: Variants
  className?: string
  onChoreographyComplete?: () => void
}

export function Choreography({
  items,
  masterSequence,
  className = '',
  onChoreographyComplete,
}: ChoreographyProps) {
  const masterControls = useAnimation()

  useEffect(() => {
    const runChoreography = async () => {
      if (masterSequence) {
        const animateStep = masterSequence['animate']
        await masterControls.start(animateStep ?? 'animate')
      }
      onChoreographyComplete?.()
    }

    void runChoreography()
  }, [masterControls, masterSequence, onChoreographyComplete])

  return (
    <motion.div
      className={className}
      initial="initial"
      animate={masterControls}
    >
      <AnimatePresence>
        {items.map((item) => (
          <motion.div
            key={item.id}
            variants={item.variants}
            initial="initial"
            animate="animate"
            exit="exit"
            custom={item.delay}
          >
            {item.element}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  )
}

// Export utilities
export { useReducedMotion }
export default AnimationOrchestrator
