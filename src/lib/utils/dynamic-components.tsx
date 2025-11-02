/**
 * Dynamic component imports for large components
 *
 * This file provides lazy-loaded versions of large components to reduce initial bundle size
 * and address chunk size warnings.
 */

import { Suspense } from 'react'
import React from 'react'

// Loading components with different visual styles
export const DefaultLoading = () => (
  <div className="flex items-center justify-center p-4 min-h-[200px]">
    <div className="animate-pulse text-muted-foreground">Loading...</div>
  </div>
)

export const VisualizationLoading = () => (
  <div className="flex items-center justify-center p-8 min-h-[400px] bg-slate-50 rounded-lg">
    <div className="flex flex-col items-center gap-2">
      <div className="h-8 w-8 border-4 border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent rounded-full animate-spin"></div>
      <div className="text-sm text-slate-500">Loading visualization...</div>
    </div>
  </div>
)

export const ThreeDLoading = () => (
  <div className="flex items-center justify-center p-8 min-h-[400px] bg-slate-50 rounded-lg">
    <div className="flex flex-col items-center gap-2">
      <div className="h-10 w-10 border-4 border-t-indigo-500 border-r-transparent border-b-indigo-500 border-l-transparent rounded-full animate-spin"></div>
      <div className="text-sm text-slate-500">Loading 3D visualization...</div>
    </div>
  </div>
)

// Error fallback component
export const ErrorFallback = ({ error }: { error: Error }) => (
  <div className="p-4 border border-red-200 bg-red-50 rounded-md">
    <p className="text-red-600 font-medium">Failed to load component</p>
    <p className="text-sm text-red-500">{String(error)}</p>
  </div>
)

// Dynamic imports for large visualization components
export const MultidimensionalEmotionChart = React.lazy(() =>
  import('../../components/three/MultidimensionalEmotionChart').then(
    (module) => ({
      default: module.default,
    }),
  ),
)

export const DynamicMultidimensionalEmotionChart = (
  props: Record<string, unknown>,
) => (
  <Suspense fallback={<ThreeDLoading />}>
    <MultidimensionalEmotionChart {...props} />
  </Suspense>
)

export const EmotionTemporalAnalysisChart = React.lazy(() =>
  import('../../components/session/EmotionTemporalAnalysisChart').then(
    (module) => ({
      default: module.default,
    }),
  ),
)

export const DynamicEmotionTemporalAnalysisChart = (
  props: Record<string, unknown>,
) => (
  <Suspense fallback={<VisualizationLoading />}>
    <EmotionTemporalAnalysisChart {...props} />
  </Suspense>
)

export const TherapyChatSystem = React.lazy(
  () => import('../../components/chat/TherapyChatSystem'),
)

export const DynamicTherapyChatSystem = (props: Record<string, unknown>) => (
  <Suspense fallback={<DefaultLoading />}>
    <TherapyChatSystem {...props} />
  </Suspense>
)

// Dynamic imports for large data processing components
export const FHEDemo = React.lazy(() =>
  import('../../components/security/FHEDemo').then((module) => ({
    default: module.default,
  })),
)

export const DynamicFHEDemo = (props: Record<string, unknown>) => (
  <Suspense fallback={<DefaultLoading />}>
    <FHEDemo {...props} />
  </Suspense>
)

// Dynamic imports for large UI components
export const SwiperCarousel = React.lazy(
  () => import('../../components/ui/SwiperCarousel'),
)

export const DynamicSwiperCarousel = (props: Record<string, unknown>) => (
  <Suspense fallback={<DefaultLoading />}>
    <SwiperCarousel {...props} />
  </Suspense>
)

// Dynamic imports for chart components
export const ChartComponent = React.lazy(
  () => import('../../components/analytics/ChartComponent'),
)

export const DynamicChartComponent = (props: Record<string, unknown>) => (
  <Suspense fallback={<VisualizationLoading />}>
    <ChartComponent {...props} />
  </Suspense>
)

// Dynamic imports for large dashboard components
export const TreatmentPlanManager = React.lazy(
  () => import('../../components/treatment/TreatmentPlanManager'),
)

export const DynamicTreatmentPlanManager = (props: Record<string, unknown>) => (
  <Suspense fallback={<DefaultLoading />}>
    <TreatmentPlanManager {...props} />
  </Suspense>
)

// Dynamic imports for large particle visualizations
export const ParticleVisualization = React.lazy(() =>
  import('../../components/three/Particle').then((module) => ({
    default: module.default,
  })),
)

export const DynamicParticleVisualization = (
  props: Record<string, unknown>,
) => (
  <Suspense fallback={<ThreeDLoading />}>
    <ParticleVisualization {...props} />
  </Suspense>
)

// Dynamically import Three.js module when needed
export const useThreeModule = () => {
  const [threeModule, setThreeModule] = React.useState<unknown>(null)

  React.useEffect(() => {
    import('three').then((module) => {
      setThreeModule(module)
    })
  }, [])

  return threeModule
}

// Dynamically import chart.js module when needed
export const useChartModule = () => {
  const [chartModule, setChartModule] = React.useState<unknown>(null)

  React.useEffect(() => {
    import('chart.js').then((module) => {
      setChartModule(module)
    })
  }, [])

  return chartModule
}
