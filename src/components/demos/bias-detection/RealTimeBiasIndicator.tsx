// Real-time bias indicator component for live feedback
import React, { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface BiasIndicator {
  type: 'demographic' | 'cultural' | 'linguistic' | 'gender' | 'age'
  severity: 'low' | 'medium' | 'high'
  confidence: number
  description: string
  suggestion: string
}

interface RealTimeBiasIndicatorProps {
  content: string
  demographics: {
    age: string
    gender: string
    ethnicity: string
    primaryLanguage: string
  }
  onBiasUpdate?: (indicators: BiasIndicator[]) => void
}

export const RealTimeBiasIndicator: React.FC<RealTimeBiasIndicatorProps> = ({
  content,
  demographics,
  onBiasUpdate,
}) => {
  // Real-time bias analysis
  const biasIndicators = useMemo(() => {
    if (!content || content.length < 10) return []

    const indicators: BiasIndicator[] = []
    const lowerContent = content.toLowerCase()

    // Demographic bias patterns
    const demographicTerms = [
      'young people',
      'elderly',
      'older adults',
      'teenagers',
      'seniors',
      'boys',
      'girls',
      'men',
      'women',
      'guys',
      'ladies',
    ]

    const culturalTerms = [
      'your culture',
      'your people',
      'where you come from',
      'typical for',
      'in your community',
      'your background',
    ]

    const genderBiasTerms = [
      'emotional',
      'hysterical',
      'aggressive',
      'sensitive',
      'weak',
      'provider',
      'caregiver',
      'natural',
      'should be',
    ]

    // Check for demographic assumptions
    demographicTerms.forEach((term) => {
      if (lowerContent.includes(term)) {
        indicators.push({
          type: 'demographic',
          severity: 'medium',
          confidence: 0.75,
          description: `Potential demographic generalization: "${term}"`,
          suggestion:
            'Consider using more specific, individual-focused language',
        })
      }
    })

    // Check for cultural bias
    culturalTerms.forEach((term) => {
      if (lowerContent.includes(term)) {
        indicators.push({
          type: 'cultural',
          severity: 'high',
          confidence: 0.85,
          description: `Cultural assumption detected: "${term}"`,
          suggestion:
            'Avoid cultural generalizations; focus on individual experiences',
        })
      }
    })

    // Check for gender bias
    genderBiasTerms.forEach((term) => {
      if (lowerContent.includes(term)) {
        indicators.push({
          type: 'gender',
          severity: 'medium',
          confidence: 0.7,
          description: `Potential gender bias: "${term}"`,
          suggestion: 'Use gender-neutral language when possible',
        })
      }
    })

    // Language complexity bias
    const words = content.split(/\s+/)
    const avgWordLength =
      words.reduce((sum, word) => sum + word.length, 0) / words.length

    if (avgWordLength > 6 && demographics.primaryLanguage !== 'en') {
      indicators.push({
        type: 'linguistic',
        severity: 'low',
        confidence: 0.6,
        description:
          'Complex language may create barriers for non-native speakers',
        suggestion: 'Consider simplifying language for better accessibility',
      })
    }

    // Age-related bias
    if (
      demographics.age === '65+' &&
      (lowerContent.includes('technology') || lowerContent.includes('digital'))
    ) {
      indicators.push({
        type: 'age',
        severity: 'low',
        confidence: 0.65,
        description: 'Age-related technology assumptions may be present',
        suggestion: 'Avoid assumptions about technology comfort based on age',
      })
    }

    onBiasUpdate?.(indicators)
    return indicators
  }, [content, demographics, onBiasUpdate])

  const overallScore = useMemo(() => {
    if (biasIndicators.length === 0) return 100

    const totalSeverity = biasIndicators.reduce((sum, indicator) => {
      const severityWeight =
        indicator.severity === 'high'
          ? 3
          : indicator.severity === 'medium'
            ? 2
            : 1
      return sum + severityWeight * indicator.confidence
    }, 0)

    return Math.max(0, 100 - totalSeverity * 10)
  }, [biasIndicators])

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100'
    if (score >= 60) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  if (!content || content.length < 10) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="text-center text-gray-500">
          <div className="text-sm">Real-time Bias Analysis</div>
          <div className="text-xs mt-1">
            Start typing to see live feedback...
          </div>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg border border-gray-200 p-4 space-y-4"
    >
      {/* Overall Score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getScoreBgColor(overallScore)} ${getScoreColor(overallScore)}`}
          >
            Bias Score: {Math.round(overallScore)}/100
          </div>
          <div className="text-sm text-gray-600">
            {overallScore >= 80
              ? '✓ Excellent'
              : overallScore >= 60
                ? '⚠ Needs Review'
                : '⚠ High Risk'}
          </div>
        </div>

        {/* Live indicator */}
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex items-center space-x-1 text-blue-600"
        >
          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
          <span className="text-xs">Live</span>
        </motion.div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <motion.div
          className={`h-2 rounded-full transition-all duration-500 ${
            overallScore >= 80
              ? 'bg-green-500'
              : overallScore >= 60
                ? 'bg-yellow-500'
                : 'bg-red-500'
          }`}
          style={{ width: `${overallScore}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${overallScore}%` }}
        />
      </div>

      {/* Bias Indicators */}
      <AnimatePresence>
        {biasIndicators.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <div className="text-sm font-medium text-gray-700">
              Detected Issues:
            </div>
            {biasIndicators.map((indicator, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`p-3 rounded-lg border-l-4 ${
                  indicator.severity === 'high'
                    ? 'bg-red-50 border-red-400'
                    : indicator.severity === 'medium'
                      ? 'bg-yellow-50 border-yellow-400'
                      : 'bg-blue-50 border-blue-400'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          indicator.type === 'demographic'
                            ? 'bg-purple-100 text-purple-800'
                            : indicator.type === 'cultural'
                              ? 'bg-orange-100 text-orange-800'
                              : indicator.type === 'gender'
                                ? 'bg-pink-100 text-pink-800'
                                : indicator.type === 'linguistic'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {indicator.type}
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          indicator.severity === 'high'
                            ? 'text-red-600'
                            : indicator.severity === 'medium'
                              ? 'text-yellow-600'
                              : 'text-blue-600'
                        }`}
                      >
                        {indicator.severity.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700 mt-1">
                      {indicator.description}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      💡 {indicator.suggestion}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 ml-2">
                    {Math.round(indicator.confidence * 100)}%
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* No issues found */}
      {biasIndicators.length === 0 && overallScore >= 80 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-green-50 border border-green-200 rounded-lg p-3"
        >
          <div className="flex items-center space-x-2">
            <svg
              className="w-5 h-5 text-green-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm text-green-800 font-medium">
              No significant bias patterns detected
            </span>
          </div>
          <p className="text-xs text-green-700 mt-1">
            Content appears to use inclusive, unbiased language.
          </p>
        </motion.div>
      )}
    </motion.div>
  )
}

export default RealTimeBiasIndicator
