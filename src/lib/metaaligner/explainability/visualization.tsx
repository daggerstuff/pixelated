/**
 * MetaAligner Explainable Alignment Visualization Components
 * Provides React components for visualizing objective evaluation results and alignment metrics
 */

import { LineChart, PieChart } from '@/components/ui/charts'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ObjectiveMetrics,
  AlignmentMetrics,
  CriteriaMetrics,
  TimestampedEvaluation,
} from '../core/objective-metrics'
import { ObjectiveDefinition } from '../core/objectives'

/**
 * Helper function to map score ranges to valid Badge variants
 */
function getBadgeVariant(
  score: number,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (score >= 0.7) {
    return 'default'
  } // Green equivalent (good score)
  if (score >= 0.4) {
    return 'secondary'
  } // Yellow/warning equivalent (moderate score)
  return 'destructive' // Red equivalent (poor score)
}

/**
 * Helper function to map trend values to valid Badge variants
 */
function getTrendBadgeVariant(
  trend: number,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (trend > 5) {
    return 'default'
  } // Positive trend (green)
  if (trend < -5) {
    return 'destructive'
  } // Negative trend (red)
  return 'secondary' // Neutral trend (gray)
}

export interface ObjectiveScoreVisualizationProps {
  objectiveMetrics: Record<string, ObjectiveMetrics>
  objectives: ObjectiveDefinition[]
  className?: string
}

export interface CriteriaBreakdownVisualizationProps {
  criteriaMetrics: CriteriaMetrics[]
  objectiveName: string
  className?: string
}

export interface AlignmentTrendVisualizationProps {
  evaluationHistory: TimestampedEvaluation[]
  objectiveId?: string // If specified, shows trend for specific objective
  className?: string
}

export interface AlignmentComparisonProps {
  beforeMetrics: AlignmentMetrics
  afterMetrics: AlignmentMetrics
  className?: string
}

export interface ObjectiveInfluenceProps {
  objectiveMetrics: Record<string, ObjectiveMetrics>
  objectives: ObjectiveDefinition[]
  className?: string
}

/**
 * Visualizes objective scores as a horizontal bar chart with color coding
 */
export function ObjectiveScoreVisualization({
  objectiveMetrics,
  objectives,
  className = '',
}: ObjectiveScoreVisualizationProps) {
  const scores = objectives.map((obj) => objectiveMetrics[obj.id]?.score || 0)

  // Color code based on score: red (0-0.4), yellow (0.4-0.7), green (0.7-1.0)
  const colors = scores.map((score) => {
    if (score >= 0.7) {
      return '#10b981'
    } // Green
    if (score >= 0.4) {
      return '#f59e0b'
    } // Yellow/Orange
    return '#ef4444' // Red
  })

  return (
    <Card className={`p-6 ${className}`}>
      <h3 className="text-lg font-semibold mb-4">Objective Performance</h3>
      <div className="space-y-4">
        {objectives.map((obj, index) => {
          const metrics = objectiveMetrics[obj.id]
          const score = metrics?.score || 0
          const confidence = metrics?.confidence || 0

          return (
            <div key={obj.id} className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{obj.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={getBadgeVariant(score)}>
                      {(score * 100).toFixed(1)}%
                    </Badge>
                    {confidence < 0.7 && (
                      <Badge variant="outline" className="text-xs">
                        Low Confidence
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${score * 100}%`,
                      backgroundColor: colors[index],
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{obj.description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/**
 * Shows detailed breakdown of criteria scores for a specific objective
 */
export function CriteriaBreakdownVisualization({
  criteriaMetrics,
  objectiveName,
  className = '',
}: CriteriaBreakdownVisualizationProps) {
  const data = criteriaMetrics.map((c) => c.score * 100)
  const labels = criteriaMetrics.map((c) =>
    c.criterion.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
  )
  const colors = ['#8b5cf6', '#6366f1', '#ec4899', '#14b8a6', '#f59e0b']

  return (
    <Card className={`p-6 ${className}`}>
      <h3 className="text-lg font-semibold mb-4">
        {objectiveName} - Criteria Breakdown
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-64">
          <PieChart data={data} labels={labels} colors={colors} />
        </div>
        <div className="space-y-3">
          {criteriaMetrics.map((criteria, index) => (
            <div
              key={criteria.criterion}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="text-sm font-medium">
                  {criteria.criterion
                    .replace('_', ' ')
                    .replace(/\b\w/g, (l) => l.toUpperCase())}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getBadgeVariant(criteria.score)}>
                  {(criteria.score * 100).toFixed(1)}%
                </Badge>
                <span className="text-xs text-gray-500">
                  Weight: {(criteria.weight * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

/**
 * Shows trend over time for alignment scores
 */
export function AlignmentTrendVisualization({
  evaluationHistory,
  objectiveId,
  className = '',
}: AlignmentTrendVisualizationProps) {
  const sortedHistory = [...evaluationHistory].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )

  const labels = sortedHistory.map((evaluation) =>
    new Date(evaluation.timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
  )

  let data: number[]
  let chartTitle: string

  if (objectiveId) {
    data = sortedHistory.map(
      (evaluation) =>
        (evaluation.metrics.objectiveMetrics?.[objectiveId]?.score ?? 0) * 100,
    )
    let objectiveName = 'Unknown Objective'
    if (
      sortedHistory.length > 0 &&
      sortedHistory[0]?.metrics.objectiveMetrics &&
      Object.prototype.hasOwnProperty.call(
        sortedHistory[0].metrics.objectiveMetrics,
        objectiveId,
      )
    ) {
      // Try to get a more human-readable name if available
      objectiveName = objectiveId
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase())
    }

    chartTitle = `${objectiveName} Trend`
  } else {
    data = sortedHistory.map(
      (evaluation) => evaluation.metrics.overallScore * 100,
    )
    chartTitle = 'Overall Alignment Trend'
  }

  // Determine trend direction
  let trend = 0
  if (data.length >= 2) {
    const first = data.find((d) => typeof d === 'number')
    const last = [...data].reverse().find((d) => typeof d === 'number')
    if (first !== undefined && last !== undefined) {
      trend = last - first
    }
  }

  const trendColor = trend > 5 ? '#10b981' : trend < -5 ? '#ef4444' : '#f59e0b'

  return (
    <Card className={`p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{chartTitle}</h3>
        <Badge
          variant={getTrendBadgeVariant(trend)}
          className="flex items-center gap-1"
        >
          {trend > 0 ? '↗' : trend < 0 ? '↘' : '→'}
          {trend > 0 ? '+' : ''}
          {trend.toFixed(1)}%
        </Badge>
      </div>
      <div className="h-64">
        <LineChart
          data={data}
          labels={labels}
          label={chartTitle}
          color={trendColor}
        />
      </div>
    </Card>
  )
}

/**
 * Compares before and after alignment metrics
 */
export function AlignmentComparisonVisualization({
  beforeMetrics,
  afterMetrics,
  className = '',
}: AlignmentComparisonProps) {
  const objectiveIds = Object.keys(beforeMetrics.objectiveMetrics)

  const comparisonData = objectiveIds.map((id) => {
    const before = beforeMetrics.objectiveMetrics[id]?.score
      ? beforeMetrics.objectiveMetrics[id].score * 100
      : 0
    const after = afterMetrics.objectiveMetrics[id]?.score
      ? afterMetrics.objectiveMetrics[id].score * 100
      : 0
    const improvement = after - before

    return {
      objective: id.charAt(0).toUpperCase() + id.slice(1),
      before,
      after,
      improvement,
    }
  })

  const overallImprovement =
    (afterMetrics.overallScore - beforeMetrics.overallScore) * 100

  return (
    <Card className={`p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Before vs After Alignment</h3>
        <Badge
          variant={getTrendBadgeVariant(overallImprovement)}
          className="flex items-center gap-1"
        >
          Overall: {overallImprovement > 0 ? '+' : ''}
          {overallImprovement.toFixed(1)}%
        </Badge>
      </div>

      <div className="space-y-4">
        {comparisonData.map((data) => (
          <div key={data.objective} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">{data.objective}</span>
              <Badge variant={getTrendBadgeVariant(data.improvement)}>
                {data.improvement > 0 ? '+' : ''}
                {data.improvement.toFixed(1)}%
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500 mb-1">Before</div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-gray-400"
                    style={{ width: `${data.before}%` }}
                  />
                </div>
                <div className="text-xs text-right mt-1">
                  {data.before.toFixed(1)}%
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500 mb-1">After</div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-blue-500"
                    style={{ width: `${data.after}%` }}
                  />
                </div>
                <div className="text-xs text-right mt-1">
                  {data.after.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

/**
 * Shows objective influence and weighting in the overall score
 */
export function ObjectiveInfluenceVisualization({
  objectiveMetrics,
  objectives,
  className = '',
}: ObjectiveInfluenceProps) {
  const influenceData = objectives.map((obj) => {
    const metrics = objectiveMetrics[obj.id]
    const score = metrics?.score || 0
    const { weight } = obj
    const contribution = score * weight * 100 // Contribution to overall score

    return {
      name: obj.name,
      weight: weight * 100,
      score: score * 100,
      contribution,
      contextualFit: (metrics?.contextualFit || 0) * 100,
    }
  })

  const data = influenceData.map((d) => d.contribution)
  const labels = influenceData.map((d) => d.name)
  const colors = ['#8b5cf6', '#6366f1', '#ec4899', '#14b8a6', '#f59e0b']

  return (
    <Card className={`p-6 ${className}`}>
      <h3 className="text-lg font-semibold mb-4">
        Objective Influence on Overall Score
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64">
          <PieChart data={data} labels={labels} colors={colors} />
        </div>

        <div className="space-y-3">
          {influenceData.map((item, index) => (
            <div key={item.name} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: colors[index % colors.length] }}
                  />
                  <span className="font-medium text-sm">{item.name}</span>
                </div>
                <Badge variant="outline">{item.contribution.toFixed(1)}%</Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                <div>
                  <div>Weight</div>
                  <div className="font-medium">{item.weight.toFixed(0)}%</div>
                </div>
                <div>
                  <div>Score</div>
                  <div className="font-medium">{item.score.toFixed(1)}%</div>
                </div>
                <div>
                  <div>Context Fit</div>
                  <div className="font-medium">
                    {item.contextualFit.toFixed(0)}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

/**
 * Utility function to generate explanations for alignment results
 */
export function generateAlignmentExplanation(
  metrics: AlignmentMetrics,
  objectives: ObjectiveDefinition[],
): string {
  const overallScore = metrics.overallScore * 100
  const bestObjective = Object.entries(metrics.objectiveMetrics).reduce(
    (best, [id, metric]) =>
      metric.score > best.score ? { id, score: metric.score } : best,
    { id: '', score: 0 },
  )

  const worstObjective = Object.entries(metrics.objectiveMetrics).reduce(
    (worst, [id, metric]) =>
      metric.score < worst.score ? { id, score: metric.score } : worst,
    { id: '', score: 1 },
  )

  const bestObjName =
    objectives.find((o) => o.id === bestObjective.id)?.name || 'Unknown'
  const worstObjName =
    objectives.find((o) => o.id === worstObjective.id)?.name || 'Unknown'

  let explanation = `The response achieved an overall alignment score of ${overallScore.toFixed(1)}%. `

  if (overallScore >= 80) {
    explanation +=
      'This represents excellent alignment with mental health objectives. '
  } else if (overallScore >= 60) {
    explanation += 'This shows good alignment with room for improvement. '
  } else {
    explanation +=
      'This indicates significant alignment issues that should be addressed. '
  }

  explanation += `The strongest performance was in ${bestObjName} (${(bestObjective.score * 100).toFixed(1)}%), `
  explanation += `while ${worstObjName} (${(worstObjective.score * 100).toFixed(1)}%) presents the greatest opportunity for improvement.`

  if (metrics.balanceScore < 0.7) {
    explanation +=
      ' The objectives show some imbalance, suggesting the response may be over-optimizing for certain aspects at the expense of others.'
  }

  return explanation
}

/**
 * Export all visualization components
 */
export {
  ObjectiveScoreVisualization as ObjectiveScores,
  CriteriaBreakdownVisualization as CriteriaBreakdown,
  AlignmentTrendVisualization as AlignmentTrend,
  AlignmentComparisonVisualization as AlignmentComparison,
  ObjectiveInfluenceVisualization as ObjectiveInfluence,
}
