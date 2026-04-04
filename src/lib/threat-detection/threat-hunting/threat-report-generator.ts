import {
  InvestigationFinding,
  HuntFinding,
  HuntReport,
} from './types'

export class ThreatReportGenerator {
  /**
   * Generate recommendations based on findings
   */
  public generateRecommendations(findings: (InvestigationFinding | HuntFinding)[]): string[] {
    const recommendations = new Set<string>()

    for (const finding of findings) {
      if (finding.severity === 'critical') {
        recommendations.add('immediate_response_required')
        recommendations.add('escalate_to_security_team')
      }

      if (finding.severity === 'high') {
        recommendations.add('increase_monitoring')
        recommendations.add('review_security_controls')
      }

      if (finding.type === 'anomaly') {
        recommendations.add('investigate_anomaly_source')
      }

      if (finding.type === 'iocs' || finding.type === 'indicator') {
        recommendations.add('update_threat_intelligence')
        recommendations.add('block_malicious_indicators')
      }
    }

    return Array.from(recommendations)
  }

  /**
   * Generate a summary report for a hunt
   */
  public generateHuntReport(huntId: string, findings: HuntFinding[]): HuntReport {
    const severityDist: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 }
    let totalConfidence = 0

    findings.forEach(f => {
      severityDist[f.severity] = (severityDist[f.severity] || 0) + 1
      totalConfidence += f.confidence
    })

    const avgConfidence = findings.length > 0 ? totalConfidence / findings.length : 0
    const now = new Date()

    // Determine overall threat level based on the highest finding severity
    const maxSeverityNum = findings.length > 0
      ? Math.max(...findings.map(f => this.severityToNumber(f.severity)))
      : 1
    const maxSeverity = this.numberToSeverity(maxSeverityNum)

    return {
      reportId: `report_${now.getTime()}_${huntId}`,
      huntId,
      generatedAt: now,
      timestamp: now,
      summary: {
        totalFindings: findings.length,
        severityDistribution: severityDist,
        avgConfidence,
        investigationTriggered: findings.some(f => f.severity === 'high' || f.severity === 'critical')
      },
      meta: {
        threatLevel: maxSeverity,
        confidence: avgConfidence,
      },
      findings,
      recommendations: this.generateRecommendations(findings)
    }
  }

  /**
   * Severity mapping utilities
   */
  public severityToNumber(severity: string): number {
    const map: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 }
    return map[severity] || 1
  }

  public numberToSeverity(num: number): 'low' | 'medium' | 'high' | 'critical' {
    if (num >= 4) return 'critical'
    if (num >= 3) return 'high'
    if (num >= 2) return 'medium'
    return 'low'
  }

  public mapThreatLevelToSeverity(threatLevel: string): 'low' | 'medium' | 'high' | 'critical' {
    const map: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      low: 'low',
      medium: 'medium',
      high: 'high',
      critical: 'critical',
      suspicious: 'high',
      benign: 'low',
      anomaly: 'medium'
    }
    return map[threatLevel] || 'low'
  }

}
