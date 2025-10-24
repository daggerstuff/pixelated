import type { FC, ReactNode, CSSProperties } from 'react'
import React from 'react'

interface AnimationWrapperProps {
  children: ReactNode
  animation?:
    | 'fadeIn'
    | 'slideUp'
    | 'slideDown'
    | 'slideLeft'
    | 'slideRight'
    | 'scale'
    | 'bounce'
    | 'none'
  duration?: 'fast' | 'normal' | 'slow' | 'custom'
  delay?: number
  className?: string
  style?: CSSProperties
}

/**
 * Advanced animation system with smooth transitions and micro-interactions
 * Provides consistent animation patterns across the application
 */

const animationClasses = {
  fadeIn: 'animate-fade-in',
  slideUp: 'animate-slide-up',
  slideDown: 'animate-slide-down',
  slideLeft: 'animate-slide-left',
  slideRight: 'animate-slide-right',
  scale: 'animate-scale-in',
  bounce: 'animate-bounce-in',
  none: '',
}

const durationClasses = {
  fast: 'animation-fast',
  normal: 'animation-normal',
  slow: 'animation-slow',
  custom: '',
}

export const AnimationWrapper: FC<AnimationWrapperProps> = ({
  children,
  animation = 'none',
  duration = 'normal',
  delay = 0,
  className = '',
  style = {},
}) => {
  const animationClass = animationClasses[animation]
  const durationClass = durationClasses[duration]

  const combinedStyle: CSSProperties = {
    ...style,
    ...(delay > 0 && { animationDelay: `${delay}ms` }),
  }

  return (
    <div
      className={`${animationClass} ${durationClass} ${className}`.trim()}
      style={combinedStyle}
    >
      {children}
    </div>
  )
}

// Pre-configured animation components for common use cases
export const FadeIn: FC<{ children: ReactNode; delay?: number }> = ({
  children,
  delay = 0,
}) => (
  <AnimationWrapper animation="fadeIn" delay={delay}>
    {children}
  </AnimationWrapper>
)

export const SlideUp: FC<{ children: ReactNode; delay?: number }> = ({
  children,
  delay = 0,
}) => (
  <AnimationWrapper animation="slideUp" delay={delay}>
    {children}
  </AnimationWrapper>
)

export const SlideDown: FC<{ children: ReactNode; delay?: number }> = ({
  children,
  delay = 0,
}) => (
  <AnimationWrapper animation="slideDown" delay={delay}>
    {children}
  </AnimationWrapper>
)

export const ScaleIn: FC<{ children: ReactNode; delay?: number }> = ({
  children,
  delay = 0,
}) => (
  <AnimationWrapper animation="scale" delay={delay}>
    {children}
  </AnimationWrapper>
)

// Micro-interaction components
export const HoverLift: FC<{ children: ReactNode; lift?: number }> = ({
  children,
  lift = 4,
}) => (
  <div
    className="transition-transform duration-200 ease-out hover:translate-y-[-4px]"
    style={{ '--lift': `${lift}px` } as CSSProperties}
  >
    {children}
  </div>
)

export const PressEffect: FC<{ children: ReactNode; scale?: number }> = ({
  children,
  scale = 0.98,
}) => (
  <div className="transition-transform duration-75 ease-out active:scale-98">
    {children}
  </div>
)

export const GlowOnHover: FC<{
  children: ReactNode
  intensity?: 'subtle' | 'medium' | 'strong'
}> = ({ children, intensity = 'medium' }) => {
  const intensityClasses = {
    subtle: 'hover:shadow-lg',
    medium: 'hover:shadow-xl hover:shadow-blue-500/25',
    strong: 'hover:shadow-2xl hover:shadow-purple-500/30',
  }

  return (
    <div
      className={`transition-shadow duration-300 ${intensityClasses[intensity]}`}
    >
      {children}
    </div>
  )
}

// Stagger animation for lists
export const StaggerContainer: FC<{
  children: ReactNode
  staggerDelay?: number
  animation?: 'fadeIn' | 'slideUp' | 'slideLeft'
}> = ({ children, staggerDelay = 100, animation = 'fadeIn' }) => {
  const childrenArray = React.Children.toArray(children)

  return (
    <div className="stagger-container">
      {childrenArray.map((child, index) => (
        <AnimationWrapper
          key={index}
          animation={animation}
          delay={index * staggerDelay}
        >
          {child}
        </AnimationWrapper>
      ))}
    </div>
  )
}

// Loading skeleton animations
export const SkeletonLoader: FC<{ className?: string; lines?: number }> = ({
  className = '',
  lines = 1,
}) => (
  <div className={`space-y-3 ${className}`}>
    {Array.from({ length: lines }).map((_, index) => (
      <div
        key={index}
        className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
        style={{ animationDelay: `${index * 200}ms` }}
      />
    ))}
  </div>
)

// Smooth scroll animation trigger
export const ScrollReveal: FC<{
  children: ReactNode
  threshold?: number
  rootMargin?: string
}> = ({ children, threshold = 0.1, rootMargin = '0px 0px -50px 0px' }) => {
  const [isVisible, setIsVisible] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold, rootMargin },
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [threshold, rootMargin])

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      {children}
    </div>
  )
}

// Main animations CSS (to be included in global styles)
export const animationStyles = `
  /* Fade animations */
  .animate-fade-in {
    animation: fadeIn 0.5s ease-out forwards;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* Slide animations */
  .animate-slide-up {
    animation: slideUp 0.6s ease-out forwards;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-slide-down {
    animation: slideDown 0.6s ease-out forwards;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-slide-left {
    animation: slideLeft 0.6s ease-out forwards;
  }

  @keyframes slideLeft {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .animate-slide-right {
    animation: slideRight 0.6s ease-out forwards;
  }

  @keyframes slideRight {
    from {
      opacity: 0;
      transform: translateX(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  /* Scale animations */
  .animate-scale-in {
    animation: scaleIn 0.4s ease-out forwards;
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .animate-bounce-in {
    animation: bounceIn 0.8s ease-out forwards;
  }

  @keyframes bounceIn {
    0% {
      opacity: 0;
      transform: scale(0.3);
    }
    50% {
      opacity: 1;
      transform: scale(1.05);
    }
    70% {
      transform: scale(0.95);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* Duration modifiers */
  .animation-fast {
    animation-duration: 0.3s;
  }

  .animation-normal {
    animation-duration: 0.5s;
  }

  .animation-slow {
    animation-duration: 0.8s;
  }

  /* Reduce motion for accessibility */
  @media (prefers-reduced-motion: reduce) {
    .animate-fade-in,
    .animate-slide-up,
    .animate-slide-down,
    .animate-slide-left,
    .animate-slide-right,
    .animate-scale-in,
    .animate-bounce-in {
      animation: none;
    }
  }
`

// Inject animation styles into the document
if (typeof document !== 'undefined') {
  const styleId = 'advanced-animations-styles'
  if (!document.getElementById(styleId)) {
    const styleElement = document.createElement('style')
    styleElement.id = styleId
    styleElement.textContent = animationStyles
    document.head.appendChild(styleElement)
  }
}

export default AnimationWrapper
