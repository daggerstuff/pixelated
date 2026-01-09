/**
 * Performance Benchmark for Dynamic Weighting System
 * Tests sub-250ms performance and generates visualization data
 */

import { DynamicWeightingEngine } from './dynamic-weighting'
import { ContextType, type AlignmentContext } from './objectives'
import { ObjectiveId } from '../config/mapping-config'

export interface BenchmarkResult {
  testName: string
  iterations: number
  avgTimeMs: number
  minTimeMs: number
  maxTimeMs: number
  p50TimeMs: number
  p95TimeMs: number
  p99TimeMs: number
  passedThreshold: boolean
  thresholdMs: number
}

export interface BenchmarkSuite {
  suiteName: string
  timestamp: Date
  results: BenchmarkResult[]
  visualizationData: VisualizationData
}

export interface VisualizationData {
  timeSeries: TimeSeriesData[]
  weightTransitions: WeightTransitionData[]
  performanceDistribution: PerformanceDistributionData
}

export interface TimeSeriesData {
  iteration: number
  context: ContextType
  updateTimeMs: number
  weights: Record<string, number>
  blendingApplied: boolean
  oscillationDetected: boolean
}

export interface WeightTransitionData {
  fromContext: ContextType
  toContext: ContextType
  weightChanges: Record<string, number>
  smoothingEffect: number
}

export interface PerformanceDistributionData {
  buckets: { min: number; max: number; count: number }[]
  mean: number
  stdDev: number
}

/**
 * Run comprehensive performance benchmarks
 */
export async function runBenchmarkSuite(): Promise<BenchmarkSuite> {
  const suite: BenchmarkSuite = {
    suiteName: 'Dynamic Weighting Performance Benchmark',
    timestamp: new Date(),
    results: [],
    visualizationData: {
      timeSeries: [],
      weightTransitions: [],
      performanceDistribution: {
        buckets: [],
        mean: 0,
        stdDev: 0,
      },
    },
  }

  console.log('\n🚀 Starting Dynamic Weighting Benchmark Suite\n')

  // Benchmark 1: Single context calculations
  suite.results.push(await benchmarkSingleContext())

  // Benchmark 2: Context transitions
  suite.results.push(await benchmarkContextTransitions())

  // Benchmark 3: Rapid oscillations
  suite.results.push(await benchmarkRapidOscillations())

  // Benchmark 4: Crisis override performance
  suite.results.push(await benchmarkCrisisOverride())

  // Benchmark 5: Cache effectiveness
  suite.results.push(await benchmarkCacheEffectiveness())

  // Benchmark 6: All contexts (comprehensive)
  const comprehensiveResult = await benchmarkAllContexts()
  suite.results.push(comprehensiveResult)

  // Generate visualization data
  suite.visualizationData = await generateVisualizationData()

  // Print summary
  printBenchmarkSummary(suite)

  return suite
}

async function benchmarkSingleContext(): Promise<BenchmarkResult> {
  const engine = new DynamicWeightingEngine()
  const iterations = 1000
  const times: number[] = []

  const context: AlignmentContext = {
    userQuery: 'What is therapy?',
    detectedContext: ContextType.EDUCATIONAL,
    confidence: 0.85,
  }

  for (let i = 0; i < iterations; i++) {
    const result = engine.calculateDynamicWeights(context)
    times.push(result.updateTimeMs)
  }

  return calculateBenchmarkStats('Single Context (Educational)', times, 250)
}

async function benchmarkContextTransitions(): Promise<BenchmarkResult> {
  const engine = new DynamicWeightingEngine()
  const iterations = 500
  const times: number[] = []

  const contexts = [
    ContextType.GENERAL,
    ContextType.EDUCATIONAL,
    ContextType.SUPPORT,
    ContextType.CLINICAL_ASSESSMENT,
    ContextType.INFORMATIONAL,
  ]

  for (let i = 0; i < iterations; i++) {
    const contextType = contexts[i % contexts.length]
    const context: AlignmentContext = {
      userQuery: `Query ${i}`,
      detectedContext: contextType,
      confidence: 0.85,
    }

    const result = engine.calculateDynamicWeights(context)
    times.push(result.updateTimeMs)
  }

  return calculateBenchmarkStats('Context Transitions', times, 250)
}

async function benchmarkRapidOscillations(): Promise<BenchmarkResult> {
  const engine = new DynamicWeightingEngine()
  const iterations = 200
  const times: number[] = []

  for (let i = 0; i < iterations; i++) {
    const contextType = i % 2 === 0 ? ContextType.EDUCATIONAL : ContextType.SUPPORT
    const context: AlignmentContext = {
      userQuery: `Oscillation test ${i}`,
      detectedContext: contextType,
      confidence: 0.85,
    }

    const result = engine.calculateDynamicWeights(context)
    times.push(result.updateTimeMs)
  }

  return calculateBenchmarkStats('Rapid Oscillations', times, 250)
}

async function benchmarkCrisisOverride(): Promise<BenchmarkResult> {
  const engine = new DynamicWeightingEngine()
  const iterations = 500
  const times: number[] = []

  // Build some history first
  for (let i = 0; i < 10; i++) {
    const context: AlignmentContext = {
      userQuery: 'General query',
      detectedContext: ContextType.GENERAL,
      confidence: 0.85,
    }
    engine.calculateDynamicWeights(context)
  }

  // Now test crisis override performance
  for (let i = 0; i < iterations; i++) {
    const context: AlignmentContext = {
      userQuery: 'I want to end my life',
      detectedContext: ContextType.CRISIS,
      confidence: 0.95,
    }

    const result = engine.calculateDynamicWeights(context)
    times.push(result.updateTimeMs)
  }

  return calculateBenchmarkStats('Crisis Override', times, 250)
}

async function benchmarkCacheEffectiveness(): Promise<BenchmarkResult> {
  const engine = new DynamicWeightingEngine()
  const iterations = 1000
  const times: number[] = []

  const context: AlignmentContext = {
    userQuery: 'What is therapy?',
    detectedContext: ContextType.EDUCATIONAL,
    confidence: 0.85,
  }

  // First call (no cache)
  engine.calculateDynamicWeights(context)

  // Subsequent calls (cached)
  for (let i = 0; i < iterations; i++) {
    const result = engine.calculateDynamicWeights(context)
    times.push(result.updateTimeMs)
  }

  return calculateBenchmarkStats('Cache Effectiveness', times, 250)
}

async function benchmarkAllContexts(): Promise<BenchmarkResult> {
  const engine = new DynamicWeightingEngine()
  const times: number[] = []

  const allContexts = [
    ContextType.CRISIS,
    ContextType.CLINICAL_ASSESSMENT,
    ContextType.SUPPORT,
    ContextType.EDUCATIONAL,
    ContextType.INFORMATIONAL,
    ContextType.GENERAL,
  ]

  const iterations = 500

  for (let i = 0; i < iterations; i++) {
    const contextType = allContexts[i % allContexts.length]
    const context: AlignmentContext = {
      userQuery: `Query for ${contextType}`,
      detectedContext: contextType,
      confidence: 0.85,
    }

    const result = engine.calculateDynamicWeights(context)
    times.push(result.updateTimeMs)
  }

  return calculateBenchmarkStats('All Contexts (Comprehensive)', times, 250)
}

async function generateVisualizationData(): Promise<VisualizationData> {
  const engine = new DynamicWeightingEngine()
  const timeSeries: TimeSeriesData[] = []
  const weightTransitions: WeightTransitionData[] = []
  const performanceTimes: number[] = []

  const contexts = [
    ContextType.GENERAL,
    ContextType.EDUCATIONAL,
    ContextType.SUPPORT,
    ContextType.CLINICAL_ASSESSMENT,
    ContextType.CRISIS,
    ContextType.SUPPORT,
    ContextType.EDUCATIONAL,
    ContextType.GENERAL,
  ]

  let previousContext: ContextType | null = null
  let previousWeights: Record<string, number> | null = null

  for (let i = 0; i < contexts.length; i++) {
    const contextType = contexts[i]
    const context: AlignmentContext = {
      userQuery: `Visualization query ${i}`,
      detectedContext: contextType,
      confidence: 0.85,
    }

    const result = engine.calculateDynamicWeights(context)

    // Time series data
    timeSeries.push({
      iteration: i,
      context: contextType,
      updateTimeMs: result.updateTimeMs,
      weights: result.weights,
      blendingApplied: result.blendingApplied,
      oscillationDetected: result.oscillationDetected,
    })

    performanceTimes.push(result.updateTimeMs)

    // Weight transition data
    if (previousContext && previousWeights && previousContext !== contextType) {
      const weightChanges: Record<string, number> = {}
      let totalChange = 0

      for (const key in result.weights) {
        const change = result.weights[key] - previousWeights[key]
        weightChanges[key] = change
        totalChange += Math.abs(change)
      }

      const smoothingEffect = result.blendingApplied
        ? 1.0 - totalChange / Object.keys(result.weights).length
        : 0

      weightTransitions.push({
        fromContext: previousContext,
        toContext: contextType,
        weightChanges,
        smoothingEffect,
      })
    }

    previousContext = contextType
    previousWeights = { ...result.weights }
  }

  // Performance distribution
  const performanceDistribution = calculatePerformanceDistribution(performanceTimes)

  return {
    timeSeries,
    weightTransitions,
    performanceDistribution,
  }
}

function calculateBenchmarkStats(
  testName: string,
  times: number[],
  thresholdMs: number,
): BenchmarkResult {
  const sorted = [...times].sort((a, b) => a - b)
  const sum = times.reduce((acc, t) => acc + t, 0)
  const avg = sum / times.length

  const p50Index = Math.floor(times.length * 0.5)
  const p95Index = Math.floor(times.length * 0.95)
  const p99Index = Math.floor(times.length * 0.99)

  const passedThreshold = sorted[p99Index] < thresholdMs

  return {
    testName,
    iterations: times.length,
    avgTimeMs: avg,
    minTimeMs: sorted[0],
    maxTimeMs: sorted[sorted.length - 1],
    p50TimeMs: sorted[p50Index],
    p95TimeMs: sorted[p95Index],
    p99TimeMs: sorted[p99Index],
    passedThreshold,
    thresholdMs,
  }
}

function calculatePerformanceDistribution(
  times: number[],
): PerformanceDistributionData {
  const sorted = [...times].sort((a, b) => a - b)
  const mean = times.reduce((acc, t) => acc + t, 0) / times.length
  const variance =
    times.reduce((acc, t) => acc + Math.pow(t - mean, 2), 0) / times.length
  const stdDev = Math.sqrt(variance)

  // Create buckets (0-50ms, 50-100ms, 100-150ms, 150-200ms, 200-250ms, 250+ms)
  const bucketRanges = [
    { min: 0, max: 50 },
    { min: 50, max: 100 },
    { min: 100, max: 150 },
    { min: 150, max: 200 },
    { min: 200, max: 250 },
    { min: 250, max: Infinity },
  ]

  const buckets = bucketRanges.map((range) => ({
    ...range,
    count: sorted.filter((t) => t >= range.min && t < range.max).length,
  }))

  return {
    buckets,
    mean,
    stdDev,
  }
}

function printBenchmarkSummary(suite: BenchmarkSuite): void {
  console.log('\n📊 Benchmark Results Summary')
  console.log('═'.repeat(80))
  console.log(
    `${'Test Name'.padEnd(30)} | ${'Avg (ms)'.padEnd(10)} | ${'P50'.padEnd(8)} | ${'P95'.padEnd(8)} | ${'P99'.padEnd(8)} | ${'Pass'}`,
  )
  console.log('─'.repeat(80))

  for (const result of suite.results) {
    const passIcon = result.passedThreshold ? '✅' : '❌'
    console.log(
      `${result.testName.padEnd(30)} | ${result.avgTimeMs.toFixed(2).padEnd(10)} | ${result.p50TimeMs.toFixed(2).padEnd(8)} | ${result.p95TimeMs.toFixed(2).padEnd(8)} | ${result.p99TimeMs.toFixed(2).padEnd(8)} | ${passIcon}`,
    )
  }

  console.log('═'.repeat(80))

  const allPassed = suite.results.every((r) => r.passedThreshold)
  console.log(
    `\n${allPassed ? '✅ All tests passed 250ms threshold!' : '⚠️  Some tests exceeded 250ms threshold'}`,
  )

  console.log('\n📈 Performance Distribution:')
  const dist = suite.visualizationData.performanceDistribution
  console.log(`  Mean: ${dist.mean.toFixed(2)}ms`)
  console.log(`  Std Dev: ${dist.stdDev.toFixed(2)}ms`)
  console.log('\n  Distribution:')
  for (const bucket of dist.buckets) {
    const percentage = (bucket.count / suite.results[0].iterations) * 100
    const barLength = Math.floor(percentage / 2)
    const bar = '█'.repeat(barLength)
    console.log(
      `    ${bucket.min}-${bucket.max === Infinity ? '250+' : bucket.max}ms: ${bar} ${percentage.toFixed(1)}%`,
    )
  }

  console.log('\n')
}

/**
 * Export visualization data for graphing
 */
export function exportVisualizationDataForGraphing(
  suite: BenchmarkSuite,
): string {
  const data = {
    timestamp: suite.timestamp.toISOString(),
    summary: suite.results.map((r) => ({
      testName: r.testName,
      avgTimeMs: r.avgTimeMs,
      p50TimeMs: r.p50TimeMs,
      p95TimeMs: r.p95TimeMs,
      p99TimeMs: r.p99TimeMs,
      passedThreshold: r.passedThreshold,
    })),
    timeSeries: suite.visualizationData.timeSeries,
    weightTransitions: suite.visualizationData.weightTransitions,
    performanceDistribution: suite.visualizationData.performanceDistribution,
  }

  return JSON.stringify(data, null, 2)
}

// Run benchmark if executed directly
if (require.main === module) {
  runBenchmarkSuite()
    .then((suite) => {
      const jsonData = exportVisualizationDataForGraphing(suite)
      console.log('\n📁 Visualization data available (JSON):')
      console.log('   Save to file for graphing with tools like Python/matplotlib or Chart.js')
      // Optionally write to file
      // fs.writeFileSync('benchmark-results.json', jsonData)
    })
    .catch((error) => {
      console.error('Benchmark failed:', error)
      process.exit(1)
    })
}
