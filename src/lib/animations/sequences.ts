/**
 * Advanced Animation Sequences Library
 * Provides coordinated animation systems for complex UI interactions
 */

import { type Variants } from 'framer-motion'

// Base timing constants for consistent animation feel
export const TIMING = {
  fast: 0.2,
  normal: 0.4,
  slow: 0.6,
  slower: 0.8,
  slowest: 1.2,
} as const

export const EASING = {
  ease: [0.25, 0.1, 0.25, 1],
  easeIn: [0.4, 0, 1, 1],
  easeOut: [0, 0, 0.2, 1],
  easeInOut: [0.4, 0, 0.2, 1],
  backOut: [0.34, 1.56, 0.64, 1],
  anticipate: [0.22, 1, 0.36, 1],
  bouncy: [0.68, -0.55, 0.265, 1.55],
} as const

// Advanced stagger configurations
export const STAGGER = {
  children: 0.1,
  fast: 0.05,
  normal: 0.1,
  slow: 0.2,
  reverse: -0.1,
} as const

/**
 * Page transition sequences
 */
export const pageTransitionSequences: Record<string, Variants> = {
  fadeSlide: {
    initial: { opacity: 0, x: -20, scale: 0.98 },
    animate: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: {
        duration: TIMING.normal,
        ease: EASING.easeOut,
      },
    },
    exit: {
      opacity: 0,
      x: 20,
      scale: 0.98,
      transition: {
        duration: TIMING.fast,
        ease: EASING.easeIn,
      },
    },
  },

  slideUp: {
    initial: { opacity: 0, y: 30 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: TIMING.normal,
        ease: EASING.backOut,
      },
    },
    exit: {
      opacity: 0,
      y: -30,
      transition: {
        duration: TIMING.fast,
        ease: EASING.easeIn,
      },
    },
  },

  scaleIn: {
    initial: { opacity: 0, scale: 0.9, rotateX: -10 },
    animate: {
      opacity: 1,
      scale: 1,
      rotateX: 0,
      transition: {
        duration: TIMING.slow,
        ease: EASING.backOut,
      },
    },
    exit: {
      opacity: 0,
      scale: 1.1,
      rotateX: 10,
      transition: {
        duration: TIMING.normal,
        ease: EASING.easeIn,
      },
    },
  },

  morphIn: {
    initial: {
      opacity: 0,
      scale: 0.8,
      borderRadius: '50%',
      rotate: -5,
    },
    animate: {
      opacity: 1,
      scale: 1,
      borderRadius: '0%',
      rotate: 0,
      transition: {
        duration: TIMING.slower,
        ease: EASING.anticipate,
        borderRadius: {
          delay: 0.2,
        },
      },
    },
    exit: {
      opacity: 0,
      scale: 0.8,
      borderRadius: '50%',
      rotate: 5,
      transition: {
        duration: TIMING.normal,
        ease: EASING.easeIn,
      },
    },
  },
}

/**
 * List item animation sequences with staggered reveals
 */
export const listAnimationSequences: Record<string, Variants> = {
  staggeredFade: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: STAGGER.normal,
        delayChildren: 0.1,
      },
    },
    exit: {
      opacity: 0,
      transition: {
        staggerChildren: STAGGER.fast,
        staggerDirection: -1,
      },
    },
  },

  staggeredSlide: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: STAGGER.normal,
        delayChildren: 0.2,
      },
    },
    exit: {
      opacity: 0,
      transition: {
        staggerChildren: STAGGER.fast,
        staggerDirection: -1,
      },
    },
  },

  cascadeIn: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: STAGGER.slow,
        delayChildren: 0.3,
      },
    },
    exit: {
      opacity: 0,
      transition: {
        staggerChildren: STAGGER.fast,
        staggerDirection: -1,
      },
    },
  },

  waveReveal: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
    exit: {
      opacity: 0,
      transition: {
        staggerChildren: 0.02,
        staggerDirection: -1,
      },
    },
  },
}

/**
 * Individual list item animations
 */
export const listItemSequences: Record<string, Variants> = {
  fadeSlideUp: {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: TIMING.normal,
        ease: EASING.easeOut,
      },
    },
    exit: {
      opacity: 0,
      y: -10,
      scale: 0.95,
      transition: {
        duration: TIMING.fast,
        ease: EASING.easeIn,
      },
    },
  },

  springUp: {
    initial: { opacity: 0, y: 30, rotateX: 20 },
    animate: {
      opacity: 1,
      y: 0,
      rotateX: 0,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 25,
      },
    },
    exit: {
      opacity: 0,
      y: -20,
      rotateX: -20,
      transition: {
        duration: TIMING.fast,
        ease: EASING.easeIn,
      },
    },
  },

  scaleRotate: {
    initial: { opacity: 0, scale: 0.5, rotate: -10 },
    animate: {
      opacity: 1,
      scale: 1,
      rotate: 0,
      transition: {
        duration: TIMING.normal,
        ease: EASING.backOut,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.5,
      rotate: 10,
      transition: {
        duration: TIMING.fast,
        ease: EASING.easeIn,
      },
    },
  },

  slideFromLeft: {
    initial: { opacity: 0, x: -50, skewX: -5 },
    animate: {
      opacity: 1,
      x: 0,
      skewX: 0,
      transition: {
        duration: TIMING.normal,
        ease: EASING.backOut,
      },
    },
    exit: {
      opacity: 0,
      x: 50,
      skewX: 5,
      transition: {
        duration: TIMING.fast,
        ease: EASING.easeIn,
      },
    },
  },

  morphCard: {
    initial: {
      opacity: 0,
      scale: 0.8,
      borderRadius: '50%',
      filter: 'blur(10px)',
    },
    animate: {
      opacity: 1,
      scale: 1,
      borderRadius: '8px',
      filter: 'blur(0px)',
      transition: {
        duration: TIMING.slower,
        ease: EASING.anticipate,
        filter: { delay: 0.1 },
        borderRadius: { delay: 0.2 },
      },
    },
    exit: {
      opacity: 0,
      scale: 0.8,
      borderRadius: '50%',
      filter: 'blur(10px)',
      transition: {
        duration: TIMING.normal,
        ease: EASING.easeIn,
      },
    },
  },
}

/**
 * Modal/Dialog animation sequences
 */
export const modalSequences: Record<string, Variants> = {
  scaleUp: {
    initial: { opacity: 0, scale: 0.8, y: 20 },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: TIMING.normal,
        ease: EASING.backOut,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      y: 10,
      transition: {
        duration: TIMING.fast,
        ease: EASING.easeIn,
      },
    },
  },

  slideFromBottom: {
    initial: { opacity: 0, y: 100, rotateX: 20 },
    animate: {
      opacity: 1,
      y: 0,
      rotateX: 0,
      transition: {
        duration: TIMING.slow,
        ease: EASING.backOut,
      },
    },
    exit: {
      opacity: 0,
      y: 50,
      rotateX: 10,
      transition: {
        duration: TIMING.normal,
        ease: EASING.easeIn,
      },
    },
  },

  morphFromCenter: {
    initial: {
      opacity: 0,
      scale: 0.5,
      borderRadius: '50%',
      rotate: 180,
    },
    animate: {
      opacity: 1,
      scale: 1,
      borderRadius: '12px',
      rotate: 0,
      transition: {
        duration: TIMING.slower,
        ease: EASING.anticipate,
        borderRadius: { delay: 0.3 },
      },
    },
    exit: {
      opacity: 0,
      scale: 0.5,
      borderRadius: '50%',
      rotate: -180,
      transition: {
        duration: TIMING.normal,
        ease: EASING.easeIn,
      },
    },
  },
}

/**
 * Interactive element sequences (buttons, inputs, etc.)
 */
export const interactiveSequences: Record<string, Variants> = {
  buttonHover: {
    rest: { scale: 1, rotate: 0, brightness: 1 },
    hover: {
      scale: 1.05,
      rotate: 1,
      brightness: 1.1,
      transition: {
        duration: TIMING.fast,
        ease: EASING.easeOut,
      },
    },
    tap: {
      scale: 0.95,
      rotate: -1,
      transition: {
        duration: 0.1,
        ease: EASING.easeOut,
      },
    },
  },

  cardFloat: {
    rest: {
      y: 0,
      scale: 1,
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    },
    hover: {
      y: -8,
      scale: 1.02,
      boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15)',
      transition: {
        duration: TIMING.normal,
        ease: EASING.easeOut,
      },
    },
  },

  inputFocus: {
    rest: {
      scale: 1,
      borderColor: 'rgba(0, 0, 0, 0.1)',
      boxShadow: '0 0 0 0 rgba(59, 130, 246, 0)',
    },
    focus: {
      scale: 1.02,
      borderColor: 'rgba(59, 130, 246, 1)',
      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
      transition: {
        duration: TIMING.fast,
        ease: EASING.easeOut,
      },
    },
  },

  iconSpin: {
    rest: { rotate: 0 },
    loading: {
      rotate: 360,
      transition: {
        duration: 1,
        ease: 'linear',
        repeat: Infinity,
      },
    },
  },
}

/**
 * Notification/Toast sequences
 */
export const notificationSequences: Record<string, Variants> = {
  slideInRight: {
    initial: { opacity: 0, x: 100, scale: 0.8 },
    animate: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: {
        duration: TIMING.normal,
        ease: EASING.backOut,
      },
    },
    exit: {
      opacity: 0,
      x: 100,
      scale: 0.8,
      transition: {
        duration: TIMING.fast,
        ease: EASING.easeIn,
      },
    },
  },

  bounceIn: {
    initial: { opacity: 0, scale: 0.3, y: -100 },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 20,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.3,
      y: -50,
      transition: {
        duration: TIMING.fast,
        ease: EASING.easeIn,
      },
    },
  },

  morphNotification: {
    initial: {
      opacity: 0,
      scale: 0.5,
      borderRadius: '50%',
      width: '50px',
      height: '50px',
    },
    animate: {
      opacity: 1,
      scale: 1,
      borderRadius: '8px',
      width: 'auto',
      height: 'auto',
      transition: {
        duration: TIMING.slower,
        ease: EASING.anticipate,
        width: { delay: 0.2 },
        height: { delay: 0.2 },
      },
    },
    exit: {
      opacity: 0,
      scale: 0.5,
      borderRadius: '50%',
      transition: {
        duration: TIMING.normal,
        ease: EASING.easeIn,
      },
    },
  },
}

/**
 * Loading animation sequences
 */
export const loadingSequences: Record<string, Variants> = {
  dots: {
    initial: { opacity: 0.3, scale: 0.8 },
    animate: {
      opacity: [0.3, 1, 0.3],
      scale: [0.8, 1.2, 0.8],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: EASING.easeInOut,
      },
    },
  },

  pulse: {
    initial: { opacity: 1, scale: 1 },
    animate: {
      opacity: [1, 0.5, 1],
      scale: [1, 1.1, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: EASING.easeInOut,
      },
    },
  },

  skeleton: {
    initial: { opacity: 0.6 },
    animate: {
      opacity: [0.6, 1, 0.6],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: EASING.easeInOut,
      },
    },
  },
}

/**
 * Complex orchestrated sequences for dashboard/analytics
 */
export const dashboardSequences: Record<string, Variants> = {
  metricsReveal: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  },

  chartDraw: {
    initial: {
      opacity: 0,
      scale: 0.9,
      pathLength: 0,
    },
    animate: {
      opacity: 1,
      scale: 1,
      pathLength: 1,
      transition: {
        duration: 1.5,
        ease: EASING.easeOut,
        pathLength: { delay: 0.5 },
      },
    },
  },

  dataTableRows: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.3,
      },
    },
  },
}

/**
 * Utility function to get reduced motion variants
 */
export function getReducedMotionVariant(variants: Variants): Variants {
  const reducedVariants: Variants = {}

  Object.keys(variants).forEach((key) => {
    const variant = variants[key]
    if (typeof variant === 'object' && variant !== null) {
      reducedVariants[key] = {
        opacity: variant.opacity || 1,
        transition: { duration: 0.1 },
      }
    }
  })

  return reducedVariants
}

/**
 * Animation presets for common use cases
 */
export const animationPresets = {
  // Quick access to most commonly used sequences
  fadeIn: pageTransitionSequences.fadeSlide,
  slideUp: pageTransitionSequences.slideUp,
  scaleIn: pageTransitionSequences.scaleIn,

  // List animations
  stagger: listAnimationSequences.staggeredFade,
  cascade: listAnimationSequences.cascadeIn,

  // Interactive
  button: interactiveSequences.buttonHover,
  card: interactiveSequences.cardFloat,

  // Modals
  modal: modalSequences.scaleUp,

  // Notifications
  toast: notificationSequences.slideInRight,

  // Loading
  loading: loadingSequences.pulse,
} as const

export type AnimationPreset = keyof typeof animationPresets
export type SequenceType =
  | 'page'
  | 'list'
  | 'item'
  | 'modal'
  | 'interactive'
  | 'notification'
  | 'loading'
  | 'dashboard'
