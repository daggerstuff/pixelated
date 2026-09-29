// Real-time bias analysis display with comprehensive metrics visualization

import type { FC } from 'react'

import type {
  BiasAnalysisResults,
  SessionData,
} from '../../../lib/types/bias-detection'

interface BiasAnalysisDisplayProps {
  results: BiasAnalysisResults
  sessionData: SessionData | null
}

export const BiasAnalysisDisplay: FC<BiasAnalysisDisplayProps> = ({
  results,
  sessionData,
}) => {
  // Helper function to get alert level styling
  const getAlertLevelStyle = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-primary text-primary-foreground border-primary'
      case 'high':
        return 'bg-accent text-primary-foreground border-accent'
      case 'medium':
        return 'bg-primary text-primary-foreground border-primary'
      case 'low':
        return 'bg-secondary text-muted-foreground border-border'
      default:
        return 'bg-secondary text-foreground border-border'
    }
  }

  // Helper function to format bias score as percentage
  const formatScore = (score: number) => `${(score * 100).toFixed(1)}%`

  // Helper function to get score color
  const getScoreColor = (score: number) => {
    if (score >= 0.8) {
      return 'text-foreground font-bold'
    }
    if (score >= 0.6) {
      return 'text-foreground font-semibold'
    }
    if (score >= 0.4) {
      return 'text-foreground'
    }
    return 'text-muted-foreground'
  }

  return (
    <div className="bias-analysis-display space-y-6">
      {/* Overall Score and Alert Level */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Overall Bias Score */}
        <div className="rounded-none bg-secondary p-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground">
            Overall Bias Score
          </h3>
          <div className="flex items-center justify-between">
            <div
              className={`text-4xl font-bold ${getScoreColor(results.overallBiasScore)}`}
            >
              {formatScore(results.overallBiasScore)}
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Confidence</div>
              <div className="text-lg font-semibold text-foreground">
                {formatScore(results.confidence)}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="h-3 rounded-none bg-secondary">
              <div
                className={`h-3 rounded-none transition-all duration-500 ${
                  results.overallBiasScore >= 0.8
                    ? 'bg-red-500'
                    : results.overallBiasScore >= 0.6
                      ? 'bg-orange-500'
                      : results.overallBiasScore >= 0.4
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                }`}
                style={{ width: `${results.overallBiasScore * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Alert Level */}
        <div className="rounded-none bg-secondary p-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground">
            Alert Level
          </h3>
          <div
            className={`inline-flex items-center rounded-none border px-4 py-2 text-lg font-semibold ${getAlertLevelStyle(results.alertLevel)}`}
          >
            <div
              className={`mr-2 h-3 w-3 rounded-none ${
                results.alertLevel === 'critical'
                  ? 'bg-red-500'
                  : results.alertLevel === 'high'
                    ? 'bg-orange-500'
                    : results.alertLevel === 'medium'
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
              }`}
            />
            {results.alertLevel.toUpperCase()}
          </div>

          {/* Session Info */}
          {sessionData && (
            <div className="mt-4 text-sm text-muted-foreground">
              <div>Session: {results.sessionId}</div>
              <div>Analyzed: {results.timestamp.toLocaleString()}</div>
              {sessionData.scenario && (
                <div>Scenario: {sessionData.scenario}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Layer-by-Layer Analysis */}
      <div className="rounded-none border border-border bg-card p-6">
        <h3 className="mb-6 text-lg font-semibold text-foreground">
          Multi-Layer Bias Analysis
        </h3>

        <div className="space-y-6">
          {/* Preprocessing Layer */}
          <div className="rounded-none border border-border bg-secondary p-4">
            <h4 className="mb-3 font-semibold text-foreground">
              Preprocessing Layer
            </h4>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="text-center">
                <div
                  className={`text-2xl font-bold ${getScoreColor(results.layerResults.preprocessing.linguisticBias.genderBiasScore)}`}
                >
                  {formatScore(
                    results.layerResults.preprocessing.linguisticBias
                      .genderBiasScore,
                  )}
                </div>
                <div className="text-sm text-muted-foreground">Gender Bias</div>
              </div>
              <div className="text-center">
                <div
                  className={`text-2xl font-bold ${getScoreColor(results.layerResults.preprocessing.linguisticBias.racialBiasScore)}`}
                >
                  {formatScore(
                    results.layerResults.preprocessing.linguisticBias
                      .racialBiasScore,
                  )}
                </div>
                <div className="text-sm text-muted-foreground">Racial Bias</div>
              </div>
              <div className="text-center">
                <div
                  className={`text-2xl font-bold ${getScoreColor(results.layerResults.preprocessing.linguisticBias.ageBiasScore)}`}
                >
                  {formatScore(
                    results.layerResults.preprocessing.linguisticBias
                      .ageBiasScore,
                  )}
                </div>
                <div className="rounded-none border border-border bg-secondary p-4">
                  Age Bias
                </div>
              </div>
              <div className="text-center">
                <div
                  className={`text-2xl font-bold ${getScoreColor(results.layerResults.preprocessing.linguisticBias.culturalBiasScore)}`}
                >
                  {formatScore(
                    results.layerResults.preprocessing.linguisticBias
                      .culturalBiasScore,
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  Cultural Bias
                </div>
              </div>
            </div>

            {/* Diversity Index */}
            <div className="mt-4 rounded-none bg-secondary p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  Diversity Index
                </span>
                <span className="text-lg font-bold text-foreground">
                  {formatScore(
                    results.layerResults.preprocessing.representationAnalysis
                      .diversityIndex,
                  )}
                </span>
              </div>
              {results.layerResults.preprocessing.representationAnalysis
                .underrepresentedGroups.length > 0 && (
                <div className="mt-2 text-sm text-foreground">
                  Underrepresented:{' '}
                  {results.layerResults.preprocessing.representationAnalysis.underrepresentedGroups.join(
                    ', ',
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Model Layer */}
          <div className="rounded-none border border-border bg-secondary p-4">
            <h4 className="mb-3 font-semibold text-foreground">Model Layer</h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-none bg-secondary p-3 text-center">
                <div
                  className={`text-xl font-bold ${getScoreColor(1 - results.layerResults.modelLevel.fairnessMetrics.demographicParity)}`}
                >
                  {formatScore(
                    results.layerResults.modelLevel.fairnessMetrics
                      .demographicParity,
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  Demographic Parity
                </div>
              </div>
              <div className="rounded-none bg-secondary p-3 text-center">
                <div
                  className={`text-xl font-bold ${getScoreColor(1 - results.layerResults.modelLevel.fairnessMetrics.equalizedOdds)}`}
                >
                  {formatScore(
                    results.layerResults.modelLevel.fairnessMetrics
                      .equalizedOdds,
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  Equalized Odds
                </div>
              </div>
              <div className="rounded-none bg-secondary p-3 text-center">
                <div
                  className={`text-xl font-bold ${getScoreColor(1 - results.layerResults.modelLevel.fairnessMetrics.calibration)}`}
                >
                  {formatScore(
                    results.layerResults.modelLevel.fairnessMetrics.calibration,
                  )}
                </div>
                <div className="text-sm text-muted-foreground">Calibration</div>
              </div>
            </div>
          </div>

          {/* Interactive Layer */}
          <div className="rounded-none border border-border bg-secondary p-4">
            <h4 className="mb-3 font-semibold text-foreground">
              Interactive Layer
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-none bg-secondary p-3 text-center">
                <div className="text-xl font-bold text-foreground">
                  {
                    results.layerResults.interactive.counterfactualAnalysis
                      .scenariosAnalyzed
                  }
                </div>
                <div className="text-sm text-muted-foreground">
                  Scenarios Analyzed
                </div>
              </div>
              <div className="rounded-none bg-secondary p-3 text-center">
                <div
                  className={`text-xl font-bold ${
                    results.layerResults.interactive.counterfactualAnalysis
                      .biasDetected
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  {results.layerResults.interactive.counterfactualAnalysis
                    .biasDetected
                    ? 'YES'
                    : 'NO'}
                </div>
                <div className="text-sm text-muted-foreground">
                  Bias Detected
                </div>
              </div>
              <div className="rounded-none bg-secondary p-3 text-center">
                <div
                  className={`text-xl font-bold ${getScoreColor(1 - results.layerResults.interactive.counterfactualAnalysis.consistencyScore)}`}
                >
                  {formatScore(
                    results.layerResults.interactive.counterfactualAnalysis
                      .consistencyScore,
                  )}
                </div>
                <div className="text-sm text-muted-foreground">Consistency</div>
              </div>
            </div>
          </div>

          {/* Evaluation Layer */}
          <div className="rounded-none border border-border bg-secondary p-4">
            <h4 className="mb-3 font-semibold text-foreground">
              Evaluation Layer
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-none bg-secondary p-3 text-center">
                <div
                  className={`text-xl font-bold ${getScoreColor(results.layerResults.evaluation.huggingFaceMetrics.bias)}`}
                >
                  {formatScore(
                    results.layerResults.evaluation.huggingFaceMetrics.bias,
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  HF Bias Score
                </div>
              </div>
              <div className="rounded-none bg-secondary p-3 text-center">
                <div
                  className={`text-xl font-bold ${getScoreColor(results.layerResults.evaluation.huggingFaceMetrics.stereotype)}`}
                >
                  {formatScore(
                    results.layerResults.evaluation.huggingFaceMetrics
                      .stereotype,
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  Stereotype Score
                </div>
              </div>
              <div className="rounded-none bg-secondary p-3 text-center">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-muted-foreground">
                    +
                    {formatScore(
                      results.layerResults.evaluation.huggingFaceMetrics.regard
                        .positive,
                    )}
                  </span>
                  <span className="font-semibold text-foreground">
                    -
                    {formatScore(
                      results.layerResults.evaluation.huggingFaceMetrics.regard
                        .negative,
                    )}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Regard Score
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {results.recommendations.length > 0 && (
        <div className="rounded-none border border-border bg-secondary p-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground">
            Recommendations
          </h3>
          <ul className="space-y-2">
            {results.recommendations.map((recommendation) => (
              <li key={recommendation} className="flex items-start">
                <div className="mr-3 mt-2 h-2 w-2 flex-shrink-0 rounded-none bg-muted-foreground" />
                <span className="text-foreground">{recommendation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Demographics Context */}
      {results.demographics && (
        <div className="rounded-none border border-border bg-secondary p-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground">
            Demographic Context
          </h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div className="text-sm text-muted-foreground">Age Group</div>
              <div className="font-semibold text-foreground">
                {results.demographics.age}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Gender</div>
              <div className="font-semibold text-foreground">
                {results.demographics.gender}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Ethnicity</div>
              <div className="font-semibold text-foreground">
                {results.demographics.ethnicity}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">
                Primary Language
              </div>
              <div className="font-semibold text-foreground">
                {results.demographics.primaryLanguage}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BiasAnalysisDisplay
