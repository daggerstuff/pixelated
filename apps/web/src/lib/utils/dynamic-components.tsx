/**
 * Dynamic component imports for large components
 *
 * This file provides lazy-loaded versions of large components to reduce initial bundle size
 * and address chunk size warnings.
 */

import React from 'react'
import { Suspense } from 'react'
import type { ComponentProps } from 'react'

import type EmotionTemporalAnalysisChartComponent from '../../components/session/EmotionTemporalAnalysisChart'

type EmotionTemporalAnalysisChartProps = ComponentProps<
  typeof EmotionTemporalAnalysisChartComponent
>

const MultidimensionalEmotionChartFallback = ({
  className,
}: {
  className?: string
}) => (
  <div
    className={`bg-slate-100 flex h-[360px] items-center justify-center rounded-lg p-4 text-sm ${className ?? ''}`}
  >
    Multidimensional emotion visualization is temporarily unavailable.
  </div>
)

const SwiperCarouselFallback = ({ className }: { className?: string }) => (
  <div
    className={`bg-slate-100 flex h-64 items-center justify-center rounded-lg p-4 text-sm ${className ?? ''}`}
  >
    Carousel is temporarily unavailable.
  </div>
)

const ParticleVisualizationFallback = ({
  className,
}: {
  className?: string
}) => (
  <div
    className={`bg-slate-100 flex h-[360px] items-center justify-center rounded-lg p-4 text-sm ${className ?? ''}`}
  >
    Particle visualization is temporarily unavailable.
  </div>
)

// Loading components with different visual styles
const DefaultLoading = () => (
  <div className="flex min-h-[200px] items-center justify-center p-4">
    <div className="text-muted-foreground animate-pulse">Loading...</div>
  </div>
)

const VisualizationLoading = () => (
  <div className="bg-slate-50 flex min-h-[400px] items-center justify-center rounded-lg p-8">
    <div className="flex flex-col items-center gap-2">
      <div className="border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent h-8 w-8 animate-spin rounded-full border-4"></div>
      <div className="text-slate-500 text-sm">Loading visualization...</div>
    </div>
  </div>
)

const ThreeDLoading = () => (
  <div className="bg-slate-50 flex min-h-[400px] items-center justify-center rounded-lg p-8">
    <div className="flex flex-col items-center gap-2">
      <div className="border-t-indigo-500 border-r-transparent border-b-indigo-500 border-l-transparent h-10 w-10 animate-spin rounded-full border-4"></div>
      <div className="text-slate-500 text-sm">Loading 3D visualization...</div>
    </div>
  </div>
)

// Error fallback component
const ErrorFallback = ({ error }: { error: Error }) => (
  <div className="border-red-200 bg-red-50 rounded-md border p-4">
    <p className="text-red-600 font-medium">Failed to load component</p>
    <p className="text-red-500 text-sm">{String(error)}</p>
  </div>
)

// Dynamic imports for large visualization components
const MultidimensionalEmotionChart = React.lazy(async () => ({
  default: MultidimensionalEmotionChartFallback,
}))

export const DynamicMultidimensionalEmotionChart = (
  props: Record<string, unknown>,
) => (
  <Suspense fallback={<ThreeDLoading />}>
    <MultidimensionalEmotionChart {...props} />
  </Suspense>
)

const EmotionTemporalAnalysisChart = React.lazy(async () => {
  const module =
    await import('../../components/session/EmotionTemporalAnalysisChart')
  return {
    default: module.default,
  }
})

export const DynamicEmotionTemporalAnalysisChart = (
  props: EmotionTemporalAnalysisChartProps,
) => (
  <Suspense fallback={<VisualizationLoading />}>
    <EmotionTemporalAnalysisChart {...props} />
  </Suspense>
)

const TherapyChatSystem = React.lazy(async () => {
  const module = await import('../../components/chat/TherapyChatSystem')
  return { default: module.default }
})

export const DynamicTherapyChatSystem = (props: Record<string, unknown>) => (
  <Suspense fallback={<DefaultLoading />}>
    <TherapyChatSystem {...props} />
  </Suspense>
)

// Dynamic imports for large data processing components
const FHEDemo = React.lazy(async () => {
  // Explicit `.tsx` extension: `components/security/` also contains `FHEDemo.astro`,
  // and Vite resolves the extensionless specifier to the `.astro` file first
  // (resolve.extensions orders `.astro` before `.tsx`), which breaks React.lazy.
  const module = await import('../../components/security/FHEDemo.tsx')
  return { default: module.default }
})

export const DynamicFHEDemo = (props: Record<string, unknown>) => (
  <Suspense fallback={<DefaultLoading />}>
    <FHEDemo {...props} />
  </Suspense>
)

const DemoFHEDemo = React.lazy(async () => {
  const module = await import('../../components/demo/FHEDemo.tsx')
  return { default: module.default }
})

export const DynamicDemoFHEDemo = (props: Record<string, unknown>) => (
  <Suspense fallback={<DefaultLoading />}>
    <DemoFHEDemo {...props} />
  </Suspense>
)

// Dynamic imports for large UI components
const SwiperCarousel = React.lazy(async () => ({
  default: SwiperCarouselFallback,
}))

export const DynamicSwiperCarousel = (props: Record<string, unknown>) => (
  <Suspense fallback={<DefaultLoading />}>
    <SwiperCarousel {...props} />
  </Suspense>
)

// Dynamic imports for chart components
const ChartComponent = React.lazy(async () => {
  const module = await import('../../components/analytics/ChartComponent')
  return { default: module.default }
})

export const DynamicChartComponent = (props: Record<string, unknown>) => (
  <Suspense fallback={<VisualizationLoading />}>
    <ChartComponent {...props} />
  </Suspense>
)

const EnhancedChartComponent = React.lazy(async () => {
  const module =
    await import('../../components/analytics/EnhancedChartComponent')
  return { default: module.default }
})

export const DynamicEnhancedChartComponent = (
  props: Record<string, unknown>,
) => (
  <Suspense fallback={<VisualizationLoading />}>
    <EnhancedChartComponent {...props} />
  </Suspense>
)

// Dynamic imports for large dashboard components
const TreatmentPlanManager = React.lazy(async () => {
  const module = await import('../../components/therapy/TreatmentPlanManager')
  return { default: module.default }
})

export const DynamicTreatmentPlanManager = (props: Record<string, unknown>) => (
  <Suspense fallback={<DefaultLoading />}>
    <TreatmentPlanManager {...props} />
  </Suspense>
)

// Dynamic imports for large particle visualizations
const ParticleVisualization = React.lazy(async () => ({
  default: ParticleVisualizationFallback,
}))

export const DynamicParticleVisualization = (
  props: Record<string, unknown>,
) => (
  <Suspense fallback={<ThreeDLoading />}>
    <ParticleVisualization {...props} />
  </Suspense>
)

// Dynamic imports for session progress visualization components
const MultiSessionProgression = React.lazy(async () => {
  const module = await import('../../components/chat/MultiSessionProgression')
  return { default: module.MultiSessionProgression }
})

export const DynamicMultiSessionProgression = (
  props: ComponentProps<typeof MultiSessionProgression>,
) => (
  <Suspense fallback={<DefaultLoading />}>
    <MultiSessionProgression {...props} />
  </Suspense>
)

const BeliefChangeTracker = React.lazy(async () => {
  const module = await import('../../components/chat/BeliefChangeTracker')
  return { default: module.BeliefChangeTracker }
})

export const DynamicBeliefChangeTracker = (
  props: ComponentProps<typeof BeliefChangeTracker>,
) => (
  <Suspense fallback={<DefaultLoading />}>
    <BeliefChangeTracker {...props} />
  </Suspense>
)

const DefenseMechanismAdaptation = React.lazy(async () => {
  const module =
    await import('../../components/chat/DefenseMechanismAdaptation')
  return { default: module.DefenseMechanismAdaptation }
})

export const DynamicDefenseMechanismAdaptation = (
  props: ComponentProps<typeof DefenseMechanismAdaptation>,
) => (
  <Suspense fallback={<DefaultLoading />}>
    <DefenseMechanismAdaptation {...props} />
  </Suspense>
)

const GoalAttainmentScale = React.lazy(async () => {
  const module = await import('../../components/chat/GoalAttainmentScale')
  return { default: module.GoalAttainmentScale }
})

export const DynamicGoalAttainmentScale = (
  props: ComponentProps<typeof GoalAttainmentScale>,
) => (
  <Suspense fallback={<DefaultLoading />}>
    <GoalAttainmentScale {...props} />
  </Suspense>
)

// Dynamically import Three.js module when needed
// Dynamically import chart.js module when needed
const useChartModule = () => {
  const [chartModule, setChartModule] = React.useState<unknown>(null)

  React.useEffect(() => {
    void import('chart.js').then((module) => {
      setChartModule(module)
    })
  }, [])

  return chartModule
}
