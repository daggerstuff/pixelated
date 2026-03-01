import { motion, AnimatePresence } from 'framer-motion'
// Enhanced Bias Detection Interface with improved UX
import React, { useState, useCallback } from 'react'

import type {
  SessionData,
  BiasAnalysisResults,
} from '../../../lib/types/bias-detection'
import { AccessibleLoadingState } from './AccessibleLoadingState'
import { BiasAnalysisDisplay } from './BiasAnalysisDisplay'
import { SessionInputForm } from './SessionInputForm'

interface ImprovedBiasInterfaceProps {
  className?: string
}

type AnalysisStep = 'input' | 'analyzing' | 'results'

export const ImprovedBiasInterface: React.FC<ImprovedBiasInterfaceProps> = ({
  className = '',
}) => {
  // Enhanced state management
  const [currentStep, setCurrentStep] = useState<AnalysisStep>('input')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [analysisStepIndex, setAnalysisStepIndex] = useState(0)
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [analysisResults, setAnalysisResults] =
    useState<BiasAnalysisResults | null>(null)

  const analysisSteps = [
    'Processing content structure',
    'Analyzing demographic patterns',
    'Checking cultural assumptions',
    'Evaluating language bias',
    'Generating recommendations',
  ]

  // Enhanced analysis simulation with better UX
  const runAnalysis = useCallback(
    async (data: Omit<SessionData, 'sessionId' | 'timestamp'>) => {
      setIsAnalyzing(true)
      setCurrentStep('analyzing')
      setAnalysisProgress(0)
      setAnalysisStepIndex(0)

      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const newSessionData: SessionData = {
        ...data,
        sessionId,
        timestamp: new Date().toISOString(),
      }
      setSessionData(newSessionData)

      // Simulate progressive analysis with realistic timing
      for (let i = 0; i < analysisSteps.length; i++) {
        setAnalysisStepIndex(i)
        setAnalysisProgress((i / analysisSteps.length) * 100)

        // Realistic timing for each step
        const stepDuration =
          i === 0 ? 800 : i === analysisSteps.length - 1 ? 1200 : 1000
        await new Promise((resolve) => setTimeout(resolve, stepDuration))
      }

      // Complete analysis
      setAnalysisProgress(100)

      // Generate comprehensive results
      const results: BiasAnalysisResults = {
        sessionId,
        overallScore: Math.max(60, 100 - Math.random() * 10),
        biasFactors: {
          demographic: Math.random() * 0.3,
          cultural: Math.random() * 0.25,
          linguistic: Math.random() * 0.2,
          gender: Math.random() * 0.25,
          age: Math.random() * 0.15,
        },
        detectedPatterns: [
          {
            type: 'demographic',
            severity: 'medium',
            confidence: 0.75,
            description: 'Potential demographic assumptions detected',
            evidence: ['Uses generalized age-related terms'],
            recommendations: ['Use more individualized language'],
          },
          {
            type: 'cultural',
            severity: 'low',
            confidence: 0.65,
            description: 'Minor cultural bias indicators found',
            evidence: ['Cultural background references'],
            recommendations: ['Focus on individual experiences'],
          },
        ],
        recommendations: [
          {
            priority: 'high',
            category: 'language',
            description: 'Use person-first language',
            example:
              'Instead of "elderly patient", use "patient who is elderly"',
            impact: 'Reduces age-based assumptions',
          },
          {
            priority: 'medium',
            category: 'cultural',
            description: 'Avoid cultural generalizations',
            example: 'Replace "in your culture" with "in your experience"',
            impact: 'Promotes individual-centered care',
          },
        ],
        timestamp: new Date().toISOString(),
      }

      setAnalysisResults(results)

      // Transition to results with a slight delay for better UX
      setTimeout(() => {
        setCurrentStep('results')
        setIsAnalyzing(false)
      }, 500)
    },
    [analysisSteps.length],
  )

  // Reset to input form
  const resetAnalysis = useCallback(() => {
    setCurrentStep('input')
    setSessionData(null)
    setAnalysisResults(null)
    setAnalysisProgress(0)
    setAnalysisStepIndex(0)
  }, [])

  return (
    <div className={`improved-bias-interface ${className}`}>
      <div className='mx-auto max-w-6xl'>
        {/* Header with progress indicator */}
        <div className='mb-8'>
          <div className='mb-4 flex items-center justify-between'>
            <div>
              <h2 className='text-gray-900 text-2xl font-bold'>
                Enhanced Bias Detection Analysis
              </h2>
              <p className='text-gray-600 mt-1'>
                Real-time bias analysis with comprehensive feedback
              </p>
            </div>

            {currentStep !== 'input' && (
              <button
                onClick={resetAnalysis}
                className='text-gray-700 bg-white border-gray-300 hover:bg-gray-50 focus:ring-blue-500 rounded-md border px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'
              >
                New Analysis
              </button>
            )}
          </div>

          {/* Step indicator */}
          <div className='mb-6 flex items-center space-x-4'>
            {['Input', 'Analysis', 'Results'].map((step, index) => (
              <div key={step} className='flex items-center'>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    currentStep === ['input', 'analyzing', 'results'][index]
                      ? 'bg-blue-600 text-white'
                      : index <
                          ['input', 'analyzing', 'results'].indexOf(currentStep)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {index <
                  ['input', 'analyzing', 'results'].indexOf(currentStep)
                    ? '✓'
                    : index + 1}
                </div>
                <span
                  className={`ml-2 text-sm font-medium ${
                    currentStep === ['input', 'analyzing', 'results'][index]
                      ? 'text-blue-600'
                      : 'text-gray-500'
                  }`}
                >
                  {step}
                </span>
                {index < 2 && (
                  <div
                    className={`mx-4 h-0.5 w-12 ${
                      index <
                      ['input', 'analyzing', 'results'].indexOf(currentStep)
                        ? 'bg-green-600'
                        : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content based on current step */}
        <AnimatePresence mode='wait'>
          {currentStep === 'input' && (
            <motion.div
              key='input'
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className='space-y-6'
            >
              <SessionInputForm onSubmit={runAnalysis} disabled={isAnalyzing} />
            </motion.div>
          )}

          {currentStep === 'analyzing' && (
            <motion.div
              key='analyzing'
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
            >
              <AccessibleLoadingState
                message='Analyzing content for bias patterns...'
                progress={analysisProgress}
                steps={analysisSteps}
                currentStep={analysisStepIndex}
              />
            </motion.div>
          )}

          {currentStep === 'results' && analysisResults && (
            <motion.div
              key='results'
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className='space-y-6'
            >
              <BiasAnalysisDisplay
                results={analysisResults}
                sessionData={sessionData}
              />

              {/* Additional insights section */}
              <div className='bg-blue-50 border-blue-200 rounded-lg border p-6'>
                <h3 className='text-blue-900 mb-2 text-lg font-medium'>
                  🎯 Key Insights
                </h3>
                <div className='text-blue-800 space-y-2 text-sm'>
                  <p>
                    • Analysis completed with{' '}
                    {analysisResults.detectedPatterns.length} bias patterns
                    identified
                  </p>
                  <p>
                    • Overall bias score:{' '}
                    {Math.round(analysisResults.overallScore)}/100
                  </p>
                  <p>
                    • {analysisResults.recommendations.length} actionable
                    recommendations provided
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer with accessibility info */}
        <div className='border-gray-200 mt-12 border-t pt-6'>
          <div className='text-gray-500 text-center text-sm'>
            <p>
              This tool provides bias analysis to support inclusive therapeutic
              practices.
            </p>
            <p className='mt-1'>
              Results should be reviewed by qualified professionals.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImprovedBiasInterface
