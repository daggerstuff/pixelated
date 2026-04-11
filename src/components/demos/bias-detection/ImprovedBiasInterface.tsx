import { useState, useCallback } from 'react'

import {
  BiasAnalysisResults,
  SessionData,
  Demographics,
} from '@/lib/types/bias-detection'

interface ImprovedBiasInterfaceProps {
  className?: string
}

type AnalysisStep = 'input' | 'analyzing' | 'results'

const analysisSteps = [
  'Preprocessing text data',
  'Analyzing demographic patterns',
  'Detecting cultural biases',
  'Evaluating linguistic fairness',
  'Generating recommendations',
]

export function ImprovedBiasInterface({
  className = '',
}: ImprovedBiasInterfaceProps) {
  const [currentStep, setCurrentStep] = useState<AnalysisStep>('input')
  const [_sessionData, setSessionData] = useState<SessionData | null>(null)
  const [analysisResults, setAnalysisResults] =
    useState<BiasAnalysisResults | null>(null)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [analysisStepIndex, setAnalysisStepIndex] = useState(0)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Start analysis with session data
  const startAnalysis = useCallback(
    async (data: Omit<SessionData, 'sessionId' | 'timestamp'>) => {
      setCurrentStep('analyzing')
      setIsAnalyzing(true)
      setAnalysisProgress(0)
      setAnalysisStepIndex(0)

      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      const newSessionData: SessionData = {
        ...data,
        sessionId,
        timestamp: new Date(),
      }
      setSessionData(newSessionData)

      // Simulate progressive analysis with realistic timing
      for (let i = 0; i < analysisSteps.length; i++) {
        setAnalysisStepIndex(i)
        setAnalysisProgress((i / analysisSteps.length) * 100)

        const stepDuration =
          i === 0 ? 800 : i === analysisSteps.length - 1 ? 1200 : 1000
        await new Promise((resolve) => setTimeout(resolve, stepDuration))
      }

      // Complete analysis
      setAnalysisProgress(100)

      // Generate comprehensive results matching BiasAnalysisResults interface
      const results: BiasAnalysisResults = {
        sessionId,
        overallBiasScore: Math.max(60, 100 - Math.random() * 10),
        alertLevel: 'medium',
        confidence: 0.85,
        layerResults: {
          preprocessing: {
            biasScore: Math.random() * 0.3,
            linguisticBias: {
              genderBiasScore: Math.random() * 0.2,
              racialBiasScore: Math.random() * 0.15,
              ageBiasScore: Math.random() * 0.1,
              culturalBiasScore: Math.random() * 0.25,
            },
            representationAnalysis: {
              diversityIndex: 0.75,
              underrepresentedGroups: ['elderly', 'non-binary'],
            },
          },
          modelLevel: {
            biasScore: Math.random() * 0.2,
            fairnessMetrics: {
              demographicParity: 0.8,
              equalizedOdds: 0.75,
              calibration: 0.85,
            },
          },
          interactive: {
            biasScore: Math.random() * 0.15,
            counterfactualAnalysis: {
              scenariosAnalyzed: 5,
              biasDetected: true,
              consistencyScore: 0.8,
            },
          },
          evaluation: {
            biasScore: Math.random() * 0.1,
            huggingFaceMetrics: {
              bias: 0.15,
              stereotype: 0.1,
              regard: { positive: 0.7, negative: 0.3 },
            },
          },
        },
        recommendations: [
          'Use person-first language',
          'Avoid cultural generalizations',
        ],
        demographics: {
          age: 'mixed',
          gender: 'diverse',
          ethnicity: 'varied',
          primaryLanguage: 'English',
        } as Demographics,
        timestamp: new Date(),
      }

      setAnalysisResults(results)

      // Transition to results with a slight delay for better UX
      setTimeout(() => {
        setCurrentStep('results')
        setIsAnalyzing(false)
      }, 500)
    },
    [],
  )

  // Reset to input form
  const resetAnalysis = useCallback(() => {
    setCurrentStep('input')
    setSessionData(null)
    setAnalysisResults(null)
    setAnalysisProgress(0)
    setAnalysisStepIndex(0)
    setIsAnalyzing(false)
  }, [])

  return (
    <div className={`improved-bias-interface ${className}`}>
      {/* Analysis progress indicator */}
      {currentStep === 'analyzing' && (
        <div className='analysis-progress'>
          <div
            className='progress-bar'
            style={{ width: `${analysisProgress}%` }}
          />
          <p className='progress-text'>{analysisSteps[analysisStepIndex]}</p>
        </div>
      )}

      {/* Results display */}
      {currentStep === 'results' && analysisResults && (
        <div className='analysis-results'>
          <h3>Analysis Complete</h3>
          <p>
            Overall Bias Score: {Math.round(analysisResults.overallBiasScore)}
            /100
          </p>
          <p>Alert Level: {analysisResults.alertLevel}</p>
          <div className='recommendations'>
            <h4>Recommendations:</h4>
            <ul>
              {analysisResults.recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
          <button onClick={resetAnalysis} disabled={isAnalyzing}>
            Start New Analysis
          </button>
        </div>
      )}

      {/* Input form */}
      {currentStep === 'input' && (
        <div className='analysis-input'>
          <h2>Bias Analysis</h2>
          <p>Enter content to analyze for potential biases</p>
          <textarea
            placeholder='Enter text to analyze...'
            rows={5}
            className='w-full rounded border p-2'
          />
          <button
            onClick={() =>
              startAnalysis({
                scenario: 'general',
                demographics: {
                  age: 'mixed',
                  gender: 'diverse',
                  ethnicity: 'varied',
                  primaryLanguage: 'English',
                },
                content: 'Sample content for analysis',
              })
            }
            className='bg-blue-500 text-white mt-4 rounded px-4 py-2'
            disabled={isAnalyzing}
          >
            Start Analysis
          </button>
        </div>
      )}
    </div>
  )
}

export default ImprovedBiasInterface
