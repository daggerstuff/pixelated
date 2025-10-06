/**
 * Investigation utilities for threat hunting
 * Provides helper functions for threat investigation and analysis
 */

import type { ThreatHunt, InvestigationResult, ThreatIndicator } from './types'

/**
 * Analyze threat indicators and determine risk level
 */
export function analyzeThreatIndicators(indicators: ThreatIndicator[]): {
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  keyIndicators: ThreatIndicator[]
} {
  if (indicators.length === 0) {
    return {
      riskLevel: 'low',
      confidence: 0,
      keyIndicators: []
    }
  }

  // Calculate risk score based on indicator severity and frequency
  let riskScore = 0
  let confidenceScore = 0
  const keyIndicators: ThreatIndicator[] = []

  indicators.forEach(indicator => {
    const severityWeight = {
      low: 1,
      medium: 3,
      high: 5,
      critical: 10
    }[indicator.severity] || 1

    riskScore += severityWeight
    confidenceScore += indicator.confidence || 50

    if (indicator.severity === 'high' || indicator.severity === 'critical') {
      keyIndicators.push(indicator)
    }
  })

  const avgConfidence = confidenceScore / indicators.length

  // Determine risk level based on score
  let riskLevel: 'low' | 'medium' | 'high' | 'critical'
  if (riskScore >= 20) {
    riskLevel = 'critical'
  } else if (riskScore >= 10) {
    riskLevel = 'high'
  } else if (riskScore >= 5) {
    riskLevel = 'medium'
  } else {
    riskLevel = 'low'
  }

  return {
    riskLevel,
    confidence: Math.min(avgConfidence, 100),
    keyIndicators
  }
}

/**
 * Generate investigation report
 */
export function generateInvestigationReport(
  hunt: ThreatHunt,
  results: InvestigationResult[]
): string {
  const timestamp = new Date().toISOString()
  const summary = analyzeThreatIndicators(
    results.flatMap(r => r.indicators || [])
  )

  return `
# Threat Hunt Investigation Report
**Date:** ${timestamp}
**Hunt ID:** ${hunt.id}
**Hunt Name:** ${hunt.name}
**Status:** ${hunt.status}

## Executive Summary
- **Risk Level:** ${summary.riskLevel.toUpperCase()}
- **Confidence:** ${summary.confidence.toFixed(1)}%
- **Indicators Found:** ${results.length}

## Key Findings
${summary.keyIndicators.map(indicator => 
  `- **${indicator.type}** (${indicator.severity}): ${indicator.description}`
).join('\n')}

## Detailed Results
${results.map(result => `
### ${result.source} (${result.timestamp})
- **Status:** ${result.status}
- **Indicators:** ${result.indicators?.length || 0}
- **Evidence:** ${result.evidence?.length || 0} items
`).join('\n')}

## Recommendations
${summary.riskLevel === 'critical' ? '**IMMEDIATE ACTION REQUIRED** - Critical threats detected' :
  summary.riskLevel === 'high' ? '**URGENT** - High-risk threats require attention' :
  summary.riskLevel === 'medium' ? '**MODERATE** - Review and monitor threats' :
  '**LOW RISK** - Continue monitoring'}
`
}

/**
 * Validate investigation result
 */
export function validateInvestigationResult(result: InvestigationResult): boolean {
  // Basic validation
  if (!result.source || !result.timestamp || !result.status) {
    return false
  }

  // Validate indicators if present
  if (result.indicators) {
    for (const indicator of result.indicators) {
      if (!indicator.type || !indicator.description || !indicator.severity) {
        return false
      }
      if (!['low', 'medium', 'high', 'critical'].includes(indicator.severity)) {
        return false
      }
    }
  }

  return true
}

/**
 * Merge multiple investigation results
 */
export function mergeInvestigationResults(results: InvestigationResult[]): InvestigationResult {
  if (results.length === 0) {
    throw new Error('Cannot merge empty results array')
  }

  if (results.length === 1) {
    return results[0]
  }

  // Merge indicators
  const allIndicators = results.flatMap(r => r.indicators || [])
  const uniqueIndicators = allIndicators.filter((indicator, index, array) => 
    index === array.findIndex(i => i.type === indicator.type && i.description === indicator.description)
  )

  // Determine overall status (worst case)
  const statusPriority = {
    failed: 4,
    warning: 3,
    success: 2,
    info: 1
  }

  const overallStatus = results.reduce((worst, current) => {
    const currentPriority = statusPriority[current.status as keyof typeof statusPriority] || 0
    const worstPriority = statusPriority[worst as keyof typeof statusPriority] || 0
    return currentPriority > worstPriority ? current.status : worst
  }, results[0].status)

  // Merge evidence
  const allEvidence = results.flatMap(r => r.evidence || [])
  const uniqueEvidence = allEvidence.filter((evidence, index, array) => 
    index === array.findIndex(e => e.type === evidence.type && e.data === evidence.data)
  )

  return {
    source: 'merged',
    timestamp: new Date().toISOString(),
    status: overallStatus,
    indicators: uniqueIndicators,
    evidence: uniqueEvidence,
    metadata: {
      mergedResults: results.length,
      originalSources: results.map(r => r.source)
    }
  }
}

/**
 * Filter results by severity
 */
export function filterResultsBySeverity(
  results: InvestigationResult[],
  minSeverity: 'low' | 'medium' | 'high' | 'critical'
): InvestigationResult[] {
  const severityOrder = ['low', 'medium', 'high', 'critical']
  const minSeverityIndex = severityOrder.indexOf(minSeverity)

  return results.filter(result => {
    if (!result.indicators || result.indicators.length === 0) {
      return minSeverity === 'low' // Include empty results only if filtering for low
    }

    return result.indicators.some(indicator => {
      const indicatorSeverityIndex = severityOrder.indexOf(indicator.severity)
      return indicatorSeverityIndex >= minSeverityIndex
    })
  })
}

/**
 * Calculate investigation metrics
 */
export function calculateInvestigationMetrics(results: InvestigationResult[]): {
  totalResults: number
  successfulResults: number
  failedResults: number
  totalIndicators: number
  severityBreakdown: Record<string, number>
  averageConfidence: number
} {
  const metrics = {
    totalResults: results.length,
    successfulResults: 0,
    failedResults: 0,
    totalIndicators: 0,
    severityBreakdown: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    },
    averageConfidence: 0
  }

  let totalConfidence = 0
  let confidenceCount = 0

  results.forEach(result => {
    // Count by status
    if (result.status === 'success') {
      metrics.successfulResults++
    } else if (result.status === 'failed') {
      metrics.failedResults++
    }

    // Count indicators and severity
    if (result.indicators) {
      metrics.totalIndicators += result.indicators.length
      result.indicators.forEach(indicator => {
        if (indicator.severity in metrics.severityBreakdown) {
          metrics.severityBreakdown[indicator.severity]++
        }
        if (indicator.confidence) {
          totalConfidence += indicator.confidence
          confidenceCount++
        }
      })
    }
  })

  metrics.averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0

  return metrics
}