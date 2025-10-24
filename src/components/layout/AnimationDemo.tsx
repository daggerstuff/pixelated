import type { FC } from 'react'
import React from 'react'
import {
  AnimationWrapper,
  FadeIn,
  SlideUp,
  ScaleIn,
  HoverLift,
  PressEffect,
  GlowOnHover,
  StaggerContainer,
  SkeletonLoader,
  ScrollReveal,
} from './AdvancedAnimations'
import { ResponsiveContainer, ResponsiveText } from './ResponsiveUtils'

/**
 * Demonstration component showing advanced animation capabilities
 * This component showcases various animation patterns and micro-interactions
 */

export const AnimationDemo: FC = () => {
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 500)
    return () => clearTimeout(timer)
  }, [])

  const demoItems = [
    {
      title: 'Enhanced UX',
      description: 'Smooth animations create better user experiences',
      icon: '✨',
    },
    {
      title: 'Accessibility',
      description: 'Respects reduced motion preferences',
      icon: '♿',
    },
    {
      title: 'Performance',
      description: 'Optimized animations with GPU acceleration',
      icon: '⚡',
    },
    {
      title: 'Responsive',
      description: 'Animations adapt to different screen sizes',
      icon: '📱',
    },
  ]

  return (
    <ResponsiveContainer size="lg">
      <div className="space-y-8 p-8">
        <ResponsiveText size="xl" className="text-center mb-8">
          Advanced Animation System Demo
        </ResponsiveText>

        {/* Basic animations */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold mb-4">Basic Animations</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Fade In Animation</h3>
              <FadeIn delay={200}>
                <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border">
                  This content fades in smoothly
                </div>
              </FadeIn>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Slide Up Animation</h3>
              <SlideUp delay={400}>
                <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border">
                  This content slides up from below
                </div>
              </SlideUp>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Scale Animation</h3>
              <ScaleIn delay={600}>
                <div className="p-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg border">
                  This content scales in from smaller size
                </div>
              </ScaleIn>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">No Animation</h3>
              <AnimationWrapper animation="none">
                <div className="p-6 bg-gray-50 dark:bg-gray-900/20 rounded-lg border">
                  This content appears immediately
                </div>
              </AnimationWrapper>
            </div>
          </div>
        </section>

        {/* Micro-interactions */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold mb-4">Micro-Interactions</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <HoverLift>
              <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-medium mb-2">Hover Lift</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This card lifts up when you hover over it
                </p>
              </div>
            </HoverLift>

            <PressEffect>
              <button className="w-full p-6 bg-blue-500 hover:bg-blue-600 text-white rounded-lg border transition-colors">
                <h3 className="font-medium mb-2">Press Effect</h3>
                <p className="text-sm opacity-90">
                  This button has a press-down animation
                </p>
              </button>
            </PressEffect>

            <GlowOnHover intensity="strong">
              <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border">
                <h3 className="font-medium mb-2">Glow Effect</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This card glows when you hover over it
                </p>
              </div>
            </GlowOnHover>
          </div>
        </section>

        {/* Stagger animation */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold mb-4">Stagger Animation</h2>

          <StaggerContainer staggerDelay={150} animation="slideUp">
            {demoItems.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border shadow-sm"
              >
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <h3 className="font-medium">{item.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </StaggerContainer>
        </section>

        {/* Loading states */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold mb-4">Loading States</h2>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Loading content...
              </span>
              <SkeletonLoader lines={1} className="w-32" />
            </div>

            <SkeletonLoader lines={3} className="max-w-md" />
          </div>
        </section>

        {/* Scroll reveal */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold mb-4">Scroll Reveal</h2>

          <div className="space-y-8">
            {Array.from({ length: 3 }).map((_, index) => (
              <ScrollReveal key={index}>
                <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border">
                  <h3 className="font-medium mb-2">
                    Scroll-triggered Animation #{index + 1}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    This content animates in when it enters the viewport
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* Control panel */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold mb-4">Animation Controls</h2>

          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setLoaded(!loaded)}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              Toggle Load State
            </button>

            <AnimationWrapper animation={loaded ? 'fadeIn' : 'fadeIn'}>
              <div className="px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                {loaded ? 'Content Loaded!' : 'Loading...'}
              </div>
            </AnimationWrapper>
          </div>
        </section>
      </div>
    </ResponsiveContainer>
  )
}

export default AnimationDemo
