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
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Helper function to format bias score as percentage
  const formatScore = (score: number) => `${(score * 100).toFixed(1)}%`

  // Helper function to get score color
  const getScoreColor = (score: number) => {
    if (score >= 0.8) {
      return 'text-red-600'
    }
    if (score >= 0.6) {
      return 'text-orange-600'
    }
    if (score >= 0.4) {
      return 'text-yellow-600'
    }
    return 'text-green-600'
  }

  return (
    <div className='bias-analysis-display space-y-6'>
      {/* Overall Score and Alert Level */}
      <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
        {/* Overall Bias Score */}
        <div className='bg-gray-50 rounded-lg p-6'>
          <h3 className='text-gray-900 mb-4 text-lg font-semibold'>
            Overall Bias Score
          </h3>
          <div className='flex items-center justify-between'>
            <div
              className={`text-4xl font-bold ${getScoreColor(results.overallBiasScore)}`}
            >
              {formatScore(results.overallBiasScore)}
            </div>
            <div className='text-right'>
              <div className='text-gray-600 text-sm'>Confidence</div>
              <div className='text-gray-900 text-lg font-semibold'>
                {formatScore(results.confidence)}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className='mt-4'>
            <div className='bg-gray-200 h-3 rounded-full'>
              <div
                className={`h-3 rounded-full transition-all duration-500 ${
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
        <div className='bg-gray-50 rounded-lg p-6'>
          <h3 className='text-gray-900 mb-4 text-lg font-semibold'>
            Alert Level
          </h3>
          <div
            className={`inline-flex items-center rounded-full border px-4 py-2 text-lg font-semibold ${getAlertLevelStyle(results.alertLevel)}`}
          >
            <div
              className={`mr-2 h-3 w-3 rounded-full ${
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
            <div className='text-gray-600 mt-4 text-sm'>
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
      <div className='bg-white border-gray-200 rounded-lg border p-6'>
        <h3 className='text-gray-900 mb-6 text-lg font-semibold'>
          Multi-Layer Bias Analysis
        </h3>

        <div className='space-y-6'>
          {/* Preprocessing Layer */}
          <div className='border-blue-500 border-l-4 pl-4'>
            <h4 className='text-gray-900 mb-3 font-semibold'>
              Preprocessing Layer
            </h4>
            <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
              <div className='text-center'>
                <div
                  className={`text-2xl font-bold ${getScoreColor(results.layerResults.preprocessing.linguisticBias.genderBiasScore)}`}
                >
                  {formatScore(
                    results.layerResults.preprocessing.linguisticBias
                      .genderBiasScore,
                  )}
                </div>
                <div className='text-gray-600 text-sm'>Gender Bias</div>
              </div>
              <div className='text-center'>
                <div
                  className={`text-2xl font-bold ${getScoreColor(results.layerResults.preprocessing.linguisticBias.racialBiasScore)}`}
                >
                  {formatScore(
                    results.layerResults.preprocessing.linguisticBias
                      .racialBiasScore,
                  )}
                </div>
                <div className='text-gray-600 text-sm'>Racial Bias</div>
              </div>
              <div className='text-center'>
                <div
                  className={`text-2xl font-bold ${getScoreColor(results.layerResults.preprocessing.linguisticBias.ageBiasScore)}`}
                >
                  {formatScore(
                    results.layerResults.preprocessing.linguisticBias
                      .ageBiasScore,
                  )}
                </div>
                <div className='text-gray-600 text-sm'>Age Bias</div>
              </div>
              <div className='text-center'>
                <div
                  className={`text-2xl font-bold ${getScoreColor(results.layerResults.preprocessing.linguisticBias.culturalBiasScore)}`}
                >
                  {formatScore(
                    results.layerResults.preprocessing.linguisticBias
                      .culturalBiasScore,
                  )}
                </div>
                <div className='text-gray-600 text-sm'>Cultural Bias</div>
              </div>
            </div>

            {/* Diversity Index */}
            <div className='bg-blue-50 mt-4 rounded-lg p-3'>
              <div className='flex items-center justify-between'>
                <span className='text-blue-900 text-sm font-medium'>
                  Diversity Index
                </span>
                <span className='text-blue-700 text-lg font-bold'>
                  {formatScore(
                    results.layerResults.preprocessing.representationAnalysis
                      .diversityIndex,
                  )}
                </span>
              </div>
              {results.layerResults.preprocessing.representationAnalysis
                .underrepresentedGroups.length > 0 && (
                <div className='text-blue-800 mt-2 text-sm'>
                  Underrepresented:{' '}
                  {results.layerResults.preprocessing.representationAnalysis.underrepresentedGroups.join(
                    ', ',
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Model Layer */}
          <div className='border-purple-500 border-l-4 pl-4'>
            <h4 className='text-gray-900 mb-3 font-semibold'>Model Layer</h4>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
              <div className='bg-purple-50 rounded-lg p-3 text-center'>
                <div
                  className={`text-xl font-bold ${getScoreColor(1 - results.layerResults.modelLevel.fairnessMetrics.demographicParity)}`}
                >
                  {formatScore(
                    results.layerResults.modelLevel.fairnessMetrics
                      .demographicParity,
                  )}
                </div>
                <div className='text-gray-600 text-sm'>Demographic Parity</div>
              </div>
              <div className='bg-purple-50 rounded-lg p-3 text-center'>
                <div
                  className={`text-xl font-bold ${getScoreColor(1 - results.layerResults.modelLevel.fairnessMetrics.equalizedOdds)}`}
                >
                  {formatScore(
                    results.layerResults.modelLevel.fairnessMetrics
                      .equalizedOdds,
                  )}
                </div>
                <div className='text-gray-600 text-sm'>Equalized Odds</div>
              </div>
              <div className='bg-purple-50 rounded-lg p-3 text-center'>
                <div
                  className={`text-xl font-bold ${getScoreColor(1 - results.layerResults.modelLevel.fairnessMetrics.calibration)}`}
                >
                  {formatScore(
                    results.layerResults.modelLevel.fairnessMetrics.calibration,
                  )}
                </div>
                <div className='text-gray-600 text-sm'>Calibration</div>
              </div>
            </div>
          </div>

          {/* Interactive Layer */}
          <div className='border-green-500 border-l-4 pl-4'>
            <h4 className='text-gray-900 mb-3 font-semibold'>
              Interactive Layer
            </h4>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
              <div className='bg-green-50 rounded-lg p-3 text-center'>
                <div className='text-green-700 text-xl font-bold'>
                  {
                    results.layerResults.interactive.counterfactualAnalysis
                      .scenariosAnalyzed
                  }
                </div>
                <div className='text-gray-600 text-sm'>Scenarios Analyzed</div>
              </div>
              <div className='bg-green-50 rounded-lg p-3 text-center'>
                <div
                  className={`text-xl font-bold ${
                    results.layerResults.interactive.counterfactualAnalysis
                      .biasDetected
                      ? 'text-red-600'
                      : 'text-green-600'
                  }`}
                >
                  {results.layerResults.interactive.counterfactualAnalysis
                    .biasDetected
                    ? 'YES'
                    : 'NO'}
                </div>
                <div className='text-gray-600 text-sm'>Bias Detected</div>
              </div>
              <div className='bg-green-50 rounded-lg p-3 text-center'>
                <div
                  className={`text-xl font-bold ${getScoreColor(1 - results.layerResults.interactive.counterfactualAnalysis.consistencyScore)}`}
                >
                  {formatScore(
                    results.layerResults.interactive.counterfactualAnalysis
                      .consistencyScore,
                  )}
                </div>
                <div className='text-gray-600 text-sm'>Consistency</div>
              </div>
            </div>
          </div>

          {/* Evaluation Layer */}
          <div className='border-orange-500 border-l-4 pl-4'>
            <h4 className='text-gray-900 mb-3 font-semibold'>
              Evaluation Layer
            </h4>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
              <div className='bg-orange-50 rounded-lg p-3 text-center'>
                <div
                  className={`text-xl font-bold ${getScoreColor(results.layerResults.evaluation.huggingFaceMetrics.bias)}`}
                >
                  {formatScore(
                    results.layerResults.evaluation.huggingFaceMetrics.bias,
                  )}
                </div>
                <div className='text-gray-600 text-sm'>HF Bias Score</div>
              </div>
              <div className='bg-orange-50 rounded-lg p-3 text-center'>
                <div
                  className={`text-xl font-bold ${getScoreColor(results.layerResults.evaluation.huggingFaceMetrics.stereotype)}`}
                >
                  {formatScore(
                    results.layerResults.evaluation.huggingFaceMetrics
                      .stereotype,
                  )}
                </div>
                <div className='text-gray-600 text-sm'>Stereotype Score</div>
              </div>
              <div className='bg-orange-50 rounded-lg p-3 text-center'>
                <div className='flex justify-between text-sm'>
                  <span className='text-green-600 font-semibold'>
                    +
                    {formatScore(
                      results.layerResults.evaluation.huggingFaceMetrics.regard
                        .positive,
                    )}
                  </span>
                  <span className='text-red-600 font-semibold'>
                    -
                    {formatScore(
                      results.layerResults.evaluation.huggingFaceMetrics.regard
                        .negative,
                    )}
                  </span>
                </div>
                <div className='text-gray-600 text-sm'>Regard Score</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {results.recommendations.length > 0 && (
        <div className='bg-blue-50 border-blue-200 rounded-lg border p-6'>
          <h3 className='text-blue-900 mb-4 text-lg font-semibold'>
            Recommendations
          </h3>
          <ul className='space-y-2'>
            {results.recommendations.map((recommendation) => (
              <li key={recommendation} className='flex items-start'>
                <div className='bg-blue-500 mr-3 mt-2 h-2 w-2 flex-shrink-0 rounded-full' />
                <span className='text-blue-800'>{recommendation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Demographics Context */}
      {results.demographics && (
        <div className='bg-gray-50 border-gray-200 rounded-lg border p-6'>
          <h3 className='text-gray-900 mb-4 text-lg font-semibold'>
            Demographic Context
          </h3>
          <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
            <div>
              <div className='text-gray-600 text-sm'>Age Group</div>
              <div className='text-gray-900 font-semibold'>
                {results.demographics.age}
              </div>
            </div>
            <div>
              <div className='text-gray-600 text-sm'>Gender</div>
              <div className='text-gray-900 font-semibold'>
                {results.demographics.gender}
              </div>
            </div>
            <div>
              <div className='text-gray-600 text-sm'>Ethnicity</div>
              <div className='text-gray-900 font-semibold'>
                {results.demographics.ethnicity}
              </div>
            </div>
            <div>
              <div className='text-gray-600 text-sm'>Primary Language</div>
              <div className='text-gray-900 font-semibold'>
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
