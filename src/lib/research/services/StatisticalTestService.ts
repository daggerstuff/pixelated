/**
 * @file src/lib/research/services/StatisticalTestService.ts
 *
 * Real statistical test implementations for the Evidence Generation
 * pipeline.  All methods compute results from actual data — no
 * random values, no hardcoded results.
 *
 * Supported tests:
 *  - Welch's t-test (two-sample, unequal variance)
 *  - Chi-square goodness of fit
 *  - Chi-square test of independence (2×2 contingency)
 *  - Pearson correlation coefficient
 *  - Spearman rank correlation
 *  - Cohen's d (effect size)
 *  - Odds ratio (2×2 contingency)
 *  - Confidence intervals
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TTestResult {
  tStatistic: number
  degreesOfFreedom: number
  pValue: number
  effectSize: number // Cohen's d
  meanDifference: number
  confidenceInterval: [number, number]
  conclusion: 'reject_null' | 'fail_to_reject'
}

export interface ChiSquareResult {
  chiSquare: number
  degreesOfFreedom: number
  pValue: number
  effectSize: number // Cramér's V
  conclusion: 'reject_null' | 'fail_to_reject'
}

export interface CorrelationResult {
  coefficient: number
  pValue: number
  confidenceInterval: [number, number]
  effectSize: number // |r|
  conclusion: 'reject_null' | 'fail_to_reject'
}

export interface OddsRatioResult {
  oddsRatio: number
  confidenceInterval: [number, number]
  logOddsRatio: number
  standardError: number
}

export interface ConfidenceIntervalResult {
  lower: number
  upper: number
  margin: number
}

export interface StatisticalTestData {
  /** Two groups for t-test */
  groups?: { group1: number[]; group2: number[] }
  /** Contingency table for chi-square */
  contingency?: number[][]
  /** Paired observations for correlation */
  paired?: { x: number[]; y: number[] }
  /** 2×2 table values for odds ratio: a, b, c, d */
  contingency22?: { a: number; b: number; c: number; d: number }
}

// ---------------------------------------------------------------------------
// Core statistical helpers
// ---------------------------------------------------------------------------

function mean(data: number[]): number {
  if (data.length === 0) return NaN
  return data.reduce((sum, val) => sum + val, 0) / data.length
}

function variance(data: number[], ddof = 1): number {
  if (data.length <= ddof) return NaN
  const m = mean(data)
  return (
    data.reduce((sum, val) => sum + (val - m) ** 2, 0) / (data.length - ddof)
  )
}

function stdDev(data: number[], ddof = 1): number {
  return Math.sqrt(variance(data, ddof))
}

function rank(data: number[]): number[] {
  const indexed = data.map((val, idx) => ({ val, idx }))
  indexed.sort((a, b) => a.val - b.val)
  const ranks = new Array(data.length).fill(0)
  let i = 0
  while (i < indexed.length) {
    let j = i
    while (j + 1 < indexed.length && indexed[j + 1].val === indexed[i].val) {
      j++
    }
    const avgRank = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) {
      ranks[indexed[k].idx] = avgRank
    }
    i = j + 1
  }
  return ranks
}

// ---------------------------------------------------------------------------
// Distribution functions
// ---------------------------------------------------------------------------

/**
 * Regularised incomplete beta function I_x(a, b) via continued fraction.
 * Used for Student's t-distribution p-values.
 */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1

  const lbeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b)
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lbeta) / a

  // Continued fraction (Lentz's algorithm)
  let cf = 1
  let delta = 1
  const maxIter = 200
  const epsilon = 1e-15

  for (let iter = 0; iter < maxIter && Math.abs(delta) > epsilon; iter++) {
    const m = iter + 1
    const d = 2 * m
    const numerator1 = (m * (b - m) * x) / ((a + d - 1) * (a + d))
    const numerator2 =
      (-(a + m - 1) * (a + b + m - 1) * x) / ((a + d) * (a + d + 1))

    cf = 1 + numerator1 / cf
    delta = numerator2 / cf
    cf = 1 + delta
  }

  return front * cf
}

function lnGamma(x: number): number {
  const cof = [
    76.1800917294715, -86.5053203294168, 24.0140982408309, -1.2317395724502,
    0.1208650973866e-2, -0.5395239385e-5,
  ]
  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) {
    y += 1
    ser += cof[j] / y
  }
  return -tmp + Math.log((2.506628274631 * ser) / x)
}

/**
 * Two-tailed p-value for Student's t-distribution.
 */
function tDistributionPValue(t: number, df: number): number {
  const x = df / (df + t * t)
  const p = incompleteBeta(x, df / 2, 0.5)
  return Math.min(1, Math.max(0, p))
}

/**
 * P-value for chi-square distribution with k degrees of freedom.
 * Uses the regularised upper incomplete gamma function.
 */
function chiSquarePValue(chiSq: number, df: number): number {
  if (chiSq <= 0) return 1
  return upperIncompleteGamma(df / 2, chiSq / 2)
}

function upperIncompleteGamma(a: number, x: number): number {
  if (x < 0 || a <= 0) return 1
  if (x < a + 1) {
    // Series expansion
    return 1 - lowerIncompleteGammaSeries(a, x)
  }
  // Continued fraction
  return (
    Math.exp(-x + a * Math.log(x) - lnGamma(a)) * gammaContinuedFraction(a, x)
  )
}

function lowerIncompleteGammaSeries(a: number, x: number): number {
  const epsilon = 1e-15
  const maxIter = 200
  let term = 1 / a
  let sum = term
  for (let n = 1; n < maxIter; n++) {
    term *= x / (a + n)
    sum += term
    if (Math.abs(term) < Math.abs(sum) * epsilon) break
  }
  return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * sum
}

function gammaContinuedFraction(a: number, x: number): number {
  const epsilon = 1e-15
  const maxIter = 200
  let b = x + 1 - a
  let c = 1 / epsilon
  let d = 1 / b
  let h = d
  for (let i = 1; i < maxIter; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < epsilon) d = epsilon
    c = b + an / c
    if (Math.abs(c) < epsilon) c = epsilon
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < epsilon) break
  }
  return h
}

// ---------------------------------------------------------------------------
// Statistical tests
// ---------------------------------------------------------------------------

/**
 * Welch's t-test (two-sample, unequal variances).
 *
 * @param group1 Sample data from group 1
 * @param group2 Sample data from group 2
 * @param alpha Significance level (default 0.05)
 */
export function welchTTest(
  group1: number[],
  group2: number[],
  alpha = 0.05,
): TTestResult {
  const n1 = group1.length
  const n2 = group2.length
  if (n1 < 2 || n2 < 2) {
    throw new Error('Welch t-test requires at least 2 observations per group')
  }

  const m1 = mean(group1)
  const m2 = mean(group2)
  const v1 = variance(group1)
  const v2 = variance(group2)

  const meanDiff = m1 - m2

  // Welch's degrees of freedom (Welch–Satterthwaite equation)
  const se = Math.sqrt(v1 / n1 + v2 / n2)
  const df = Math.round(
    (v1 / n1 + v2 / n2) ** 2 /
      ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1)),
  )

  const t = meanDiff / se
  const pValue = tDistributionPValue(t, df)

  // Cohen's d (pooled)
  const pooledSD = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2))
  const effectSize = meanDiff / pooledSD

  // 95% CI for mean difference
  const z = tDistributionCriticalValue(1 - alpha / 2, df)
  const ciLower = meanDiff - z * se
  const ciUpper = meanDiff + z * se

  return {
    tStatistic: t,
    degreesOfFreedom: df,
    pValue,
    effectSize,
    meanDifference: meanDiff,
    confidenceInterval: [ciLower, ciUpper],
    conclusion: pValue < alpha ? 'reject_null' : 'fail_to_reject',
  }
}

/**
 * Chi-square goodness of fit test.
 *
 * @param observed Observed frequencies
 * @param expected Expected frequencies (defaults to uniform)
 * @param alpha Significance level
 */
export function chiSquareGoodnessOfFit(
  observed: number[],
  expected: number[] | null,
  alpha = 0.05,
): ChiSquareResult {
  const n = observed.length
  if (n < 2) throw new Error('Chi-square requires at least 2 categories')

  const exp = expected ?? Array(n).fill(mean(observed))
  if (exp.length !== n) {
    throw new Error('Expected array length must match observed')
  }

  let chiSq = 0
  for (let i = 0; i < n; i++) {
    if (exp[i] === 0) continue
    chiSq += (observed[i] - exp[i]) ** 2 / exp[i]
  }

  const df = n - 1
  const pValue = chiSquarePValue(chiSq, df)

  // Cramér's V = sqrt(chiSq / (N * (k-1)))
  const total = observed.reduce((sum, val) => sum + val, 0)
  const cramersV = Math.sqrt(chiSq / (total * Math.max(1, df)))

  return {
    chiSquare: chiSq,
    degreesOfFreedom: df,
    pValue,
    effectSize: cramersV,
    conclusion: pValue < alpha ? 'reject_null' : 'fail_to_reject',
  }
}

/**
 * Chi-square test of independence for a 2×2 contingency table.
 *
 * @param table [[a, b], [c, d]] — observed frequencies
 * @param alpha Significance level
 */
export function chiSquareIndependence(
  table: number[][],
  alpha = 0.05,
): ChiSquareResult {
  if (table.length !== 2 || table[0].length !== 2 || table[1].length !== 2) {
    throw new Error('Contingency table must be 2×2')
  }

  const [a, b] = table[0]
  const [c, d] = table[1]
  const row1Total = a + b
  const row2Total = c + d
  const col1Total = a + c
  const col2Total = b + d
  const grandTotal = a + b + c + d

  if (grandTotal === 0) throw new Error('Contingency table total cannot be 0')

  const expected = [
    (row1Total * col1Total) / grandTotal,
    (row1Total * col2Total) / grandTotal,
    (row2Total * col1Total) / grandTotal,
    (row2Total * col2Total) / grandTotal,
  ]

  const observed = [a, b, c, d]
  let chiSq = 0
  for (let i = 0; i < 4; i++) {
    if (expected[i] === 0) continue
    chiSq += (observed[i] - expected[i]) ** 2 / expected[i]
  }

  const df = 1
  const pValue = chiSquarePValue(chiSq, df)
  const cramersV = Math.sqrt(chiSq / grandTotal)

  return {
    chiSquare: chiSq,
    degreesOfFreedom: df,
    pValue,
    effectSize: cramersV,
    conclusion: pValue < alpha ? 'reject_null' : 'fail_to_reject',
  }
}

/**
 * Pearson correlation coefficient with p-value and confidence interval.
 *
 * @param x First variable
 * @param y Second variable
 * @param alpha Significance level
 */
export function pearsonCorrelation(
  x: number[],
  y: number[],
  alpha = 0.05,
): CorrelationResult {
  const n = x.length
  if (n !== y.length || n < 3) {
    throw new Error('Pearson correlation requires ≥3 paired observations')
  }

  const meanX = mean(x)
  const meanY = mean(y)

  let numerator = 0
  let sumSqX = 0
  let sumSqY = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    numerator += dx * dy
    sumSqX += dx * dx
    sumSqY += dy * dy
  }

  const r = numerator / Math.sqrt(sumSqX * sumSqY)

  // Fisher z-transform for CI
  const z = 0.5 * Math.log((1 + r) / (1 - r))
  const seZ = 1 / Math.sqrt(n - 3)
  const zCritical = normalQuantile(1 - alpha / 2)
  const ciLowerZ = z - zCritical * seZ
  const ciUpperZ = z + zCritical * seZ
  const ciLower = (Math.exp(2 * ciLowerZ) - 1) / (Math.exp(2 * ciLowerZ) + 1)
  const ciUpper = (Math.exp(2 * ciUpperZ) - 1) / (Math.exp(2 * ciUpperZ) + 1)

  // t-test for significance of r
  const tStat = r * Math.sqrt((n - 2) / (1 - r * r))
  const pValue = tDistributionPValue(tStat, n - 2)

  return {
    coefficient: r,
    pValue,
    confidenceInterval: [ciLower, ciUpper],
    effectSize: Math.abs(r),
    conclusion: pValue < alpha ? 'reject_null' : 'fail_to_reject',
  }
}

/**
 * Spearman rank correlation.
 *
 * @param x First variable
 * @param y Second variable
 * @param alpha Significance level
 */
export function spearmanCorrelation(
  x: number[],
  y: number[],
  alpha = 0.05,
): CorrelationResult {
  const n = x.length
  if (n !== y.length || n < 3) {
    throw new Error('Spearman correlation requires ≥3 paired observations')
  }

  const rankX = rank(x)
  const rankY = rank(y)
  return pearsonCorrelation(rankX, rankY, alpha)
}

/**
 * Cohen's d effect size (pooled standard deviation).
 */
export function cohenD(group1: number[], group2: number[]): number {
  const n1 = group1.length
  const n2 = group2.length
  if (n1 < 2 || n2 < 2) throw new Error('Cohen d requires ≥2 per group')

  const v1 = variance(group1)
  const v2 = variance(group2)
  const pooledSD = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2))
  return (mean(group1) - mean(group2)) / pooledSD
}

/**
 * Odds ratio from a 2×2 contingency table with 95% CI.
 */
export function oddsRatio(
  a: number,
  b: number,
  c: number,
  d: number,
  confidence = 0.95,
): OddsRatioResult {
  if (a <= 0 || b <= 0 || c <= 0 || d <= 0) {
    throw new Error('Odds ratio requires all cells > 0')
  }

  const or = (a * d) / (b * c)
  const logOR = Math.log(or)
  const se = Math.sqrt(1 / a + 1 / b + 1 / c + 1 / d)
  const z = normalQuantile(1 - (1 - confidence) / 2)
  const ciLower = Math.exp(logOR - z * se)
  const ciUpper = Math.exp(logOR + z * se)

  return {
    oddsRatio: or,
    confidenceInterval: [ciLower, ciUpper],
    logOddsRatio: logOR,
    standardError: se,
  }
}

/**
 * Confidence interval for a mean.
 */
export function meanConfidenceInterval(
  data: number[],
  confidence = 0.95,
): ConfidenceIntervalResult {
  const n = data.length
  if (n < 2) throw new Error('CI requires ≥2 observations')

  const m = mean(data)
  const se = stdDev(data) / Math.sqrt(n)
  const tcrit = tDistributionCriticalValue(1 - (1 - confidence) / 2, n - 1)
  const margin = tcrit * se

  return {
    lower: m - margin,
    upper: m + margin,
    margin,
  }
}

// ---------------------------------------------------------------------------
// Critical value helpers
// ---------------------------------------------------------------------------

/**
 * Approximate t-distribution critical value via inverse CDF.
 * Uses the Cornish-Fisher expansion as an approximation.
 */
function tDistributionCriticalValue(p: number, df: number): number {
  if (df > 30) {
    return normalQuantile(p) // normal approximation
  }

  // Cornish-Fisher expansion
  const z = normalQuantile(p)
  const g1 = (z ** 3 + z) / (4 * df)
  const g2 = (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * df * df)
  const g3 = (3 * z ** 7 + 19 * z ** 5 + 17 * z ** 3 - 15 * z) / (384 * df ** 3)
  return z + g1 + g2 + g3
}

/**
 * Inverse normal CDF (quantile function) using Acklam's algorithm.
 */
function normalQuantile(p: number): number {
  const a = [
    -3.969683028665376e1, 2.209460983245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
    -3.969683028665376e1, 2.209460983245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
    -3.969683028665376e1, 2.209460983245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
    -3.969683028665376e1, 2.209460983245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
    -3.969683028665376e1, 2.209460983245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
    -3.969683028665376e1, 2.209460983245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ]

  // Simplified: use Beasley-Springer-Moro algorithm
  const pLow = 0.02425
  const pHigh = 1 - pLow

  if (p < pLow) {
    // Rational approximation for lower region
    const q = Math.sqrt(-2 * Math.log(p))
    return (
      (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    )
  }

  if (p > pHigh) {
    // Rational approximation for upper region
    const q = Math.sqrt(-2 * Math.log(1 - p))
    return (
      -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    )
  }

  // Rational approximation for central region
  const q = p - 0.5
  const r = q * q
  return (
    (((((((a0 * r + a1) * r + a2) * r + a3) * r + a4) * r + a5) * q) /
      (((((b0 * r + b1) * r + b2) * r + b3) * r + b4) * r + b5)) *
      r +
    1
  )
}

// Acklam's constants for normalQuantile
const a0 = -32.9297470479464
const a1 = 8.14765307673239
const a2 = 4.65877078043961
const a3 = 0.423050509479213
const a4 = 0.0433303332728943
const a5 = 0.000197660820012394
const b0 = -32.9297470479464
const b1 = 8.14765307673239
const b2 = 4.65877078043961
const b3 = 0.423050509479213
const b4 = 0.0433303332728943
const b5 = 0.000197660820012394
const c1 = -7.784894002430293e-3
const c2 = -3.223964580411365e-1
const c3 = -2.400758277161838
const c4 = -2.549732539343734
const c5 = 4.374664141464968
const c6 = 2.938163982698783
const d1 = 7.784695709041462e-3
const d2 = 3.224671290700398e-1
const d3 = 2.445134137142996
const d4 = 3.754408661907416

// ---------------------------------------------------------------------------
// Service class (singleton)
// ---------------------------------------------------------------------------

export class StatisticalTestService {
  welchTTest = welchTTest
  chiSquareGoodnessOfFit = chiSquareGoodnessOfFit
  chiSquareIndependence = chiSquareIndependence
  pearsonCorrelation = pearsonCorrelation
  spearmanCorrelation = spearmanCorrelation
  cohenD = cohenD
  oddsRatio = oddsRatio
  meanConfidenceInterval = meanConfidenceInterval
  mean = mean
  variance = variance
  stdDev = stdDev
}

let instance: StatisticalTestService | null = null

export function getStatisticalTestService(): StatisticalTestService {
  if (!instance) {
    instance = new StatisticalTestService()
  }
  return instance
}

export function resetStatisticalTestService(): void {
  instance = null
}
