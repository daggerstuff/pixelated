import { useState, useEffect, useCallback } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { TherapeuticTechnique } from '@/simulator/types'
import { analyzeTherapeuticTechniques } from '@/simulator/utils/speechRecognition'

interface DetectedTechnique {
  technique: string
  confidence: number
  examples: string[]
}

interface MissedOpportunity {
  context: string
  suggestedTechnique: TherapeuticTechnique
  rationale: string
  exampleResponse: string
}

interface FeedbackSummary {
  positivePoints: string[]
  developmentalPoints: string[]
  overallRating: number // 0-10
  keyStrengths: string[]
  growthAreas: string[]
}

interface PatientModel {
  id: string
  name: string
  presentingIssues: string[]
  primaryDiagnosis: string
  responseStyle: {
    emotionalExpression?: string
    communicationStyle?: string
    defensiveness?: number
    openness?: number
    [key: string]: unknown
  }
  // Add other patient model properties as needed
}

export function SupervisorFeedback({
  sessionTranscript,
  patientModel: _patientModel,
  therapistResponses,
}: {
  sessionTranscript: string
  patientModel: PatientModel
  therapistResponses: string[]
}) {
  // State for feedback elements
  const [detectedTechniques, setDetectedTechniques] = useState<
    DetectedTechnique[]
  >([])
  const [missedOpportunities, setMissedOpportunities] = useState<
    MissedOpportunity[]
  >([])
  const [feedbackSummary, setFeedbackSummary] =
    useState<FeedbackSummary | null>(null)
  const [selectedTechnique, setSelectedTechnique] = useState<string | null>(
    null,
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState<
    'techniques' | 'opportunities' | 'summary'
  >('techniques')

  // Analyze therapeutic techniques used by the therapist
  const analyzeTechniques = useCallback(() => {
    setIsGenerating(true)

    // Process each therapist response
    const allTechniques: Record<
      string,
      { confidence: number; examples: string[] }
    > = {}

    therapistResponses.forEach((response) => {
      // Use utility function from simulator to detect techniques
      const detectedInResponse = analyzeTherapeuticTechniques(response)

      // Aggregate techniques across all responses
      Object.entries(detectedInResponse).forEach(([technique, confidence]) => {
        if (!allTechniques[technique]) {
          allTechniques[technique] = { confidence, examples: [response] }
        } else {
          // Update confidence (take highest)
          if (confidence > allTechniques[technique].confidence) {
            allTechniques[technique].confidence = confidence
          }
          // Add example if it's a good one (high confidence)
          if (
            confidence > 0.8 &&
            allTechniques[technique].examples.length < 3
          ) {
            allTechniques[technique].examples.push(response)
          }
        }
      })
    })

    // Convert to array format for state
    const techniquesArray = Object.entries(allTechniques).map(
      ([technique, data]) => ({
        technique,
        confidence: data.confidence,
        examples: data.examples,
      }),
    )

    // Sort by confidence
    techniquesArray.sort((a, b) => b.confidence - a.confidence)

    setDetectedTechniques(techniquesArray)
    setIsGenerating(false)
  }, [therapistResponses])

  // Identify missed therapeutic opportunities
  const identifyMissedOpportunities = useCallback(() => {
    // This would ideally use an AI model to identify missed opportunities
    // For now, implementing a simpler heuristic approach
    const opportunities: MissedOpportunity[] = []

    // Get client statements from transcript
    const clientStatements = sessionTranscript
      .split('\n')
      .filter((line) => line.startsWith('Client:'))
      .map((line) => line.replace('Client:', '').trim())

    // Check for emotional expressions that weren't validated
    const emotionalKeywords = [
      'afraid',
      'angry',
      'sad',
      'overwhelmed',
      'anxious',
      'depressed',
      'worried',
      'scared',
    ]

    clientStatements.forEach((statement) => {
      // Check for emotional content
      const hasEmotionalContent = emotionalKeywords.some((keyword) =>
        statement.toLowerCase().includes(keyword),
      )

      if (hasEmotionalContent) {
        // Check if the next therapist response contained validation
        // This is simplified; in production would check the actual response that followed
        const validationDetected = therapistResponses.some(
          (response) =>
            response.toLowerCase().includes('understand') ||
            response.toLowerCase().includes('that must be') ||
            response.toLowerCase().includes('makes sense'),
        )

        if (!validationDetected) {
          opportunities.push({
            context: statement,
            suggestedTechnique: TherapeuticTechnique.VALIDATION,
            rationale:
              'Client expressed emotional content that could benefit from validation',
            exampleResponse: `I can understand why you would feel ${emotionalKeywords.find(
              (keyword) => statement.toLowerCase().includes(keyword),
            )} in that situation. That's a valid response to what you're experiencing.`,
          })
        }
      }

      // Check for opportunities to use other techniques (simplified example)
      if (
        statement.includes('?') &&
        !therapistResponses.some((r) => r.includes('?'))
      ) {
        opportunities.push({
          context: statement,
          suggestedTechnique: TherapeuticTechnique.OPEN_ENDED_QUESTIONS,
          rationale:
            'Client is asking questions - opportunity to explore with open-ended questions',
          exampleResponse:
            'What do you think might help you in this situation? How have you dealt with similar challenges in the past?',
        })
      }
    })

    setMissedOpportunities(opportunities)
  }, [sessionTranscript, therapistResponses])

  // Generate overall feedback summary
  const generateFeedbackSummary = useCallback(() => {
    // This would ideally integrate with AI services
    // For now, implementing a simplified approach

    const techniquesCovered = detectedTechniques.map((t) => t.technique)
    const techniqueCount = techniquesCovered.length
    const averageConfidence =
      detectedTechniques.reduce((sum, t) => sum + t.confidence, 0) /
      Math.max(techniqueCount, 1)

    // Calculate overall rating based on techniques used and missed opportunities
    const overallRating = Math.min(
      10,
      Math.max(
        1,
        5 +
          (techniqueCount > 3 ? 2 : techniqueCount > 1 ? 1 : 0) +
          (averageConfidence > 0.8 ? 2 : averageConfidence > 0.6 ? 1 : 0) -
          (missedOpportunities.length > 5
            ? 2
            : missedOpportunities.length > 2
              ? 1
              : 0),
      ),
    )

    // Generate strengths based on detected techniques
    const keyStrengths = detectedTechniques
      .filter((t) => t.confidence > 0.7)
      .map((t) => `Effective use of ${t.technique}`)

    // Generate growth areas based on missed opportunities
    const growthAreas = Array.from(
      new Set(
        missedOpportunities.map(
          (o) => `Increased use of ${o.suggestedTechnique}`,
        ),
      ),
    )

    // Generate positive points
    const positivePoints = [
      `Applied ${techniqueCount} distinct therapeutic techniques`,
      ...keyStrengths.slice(0, 3),
    ]

    // Generate developmental points
    const developmentalPoints = [
      ...growthAreas.slice(0, 3),
      missedOpportunities.length > 0
        ? `Missed ${missedOpportunities.length} opportunities for therapeutic interventions`
        : 'Consider expanding your therapeutic toolkit',
    ]

    setFeedbackSummary({
      positivePoints,
      developmentalPoints,
      overallRating,
      keyStrengths,
      growthAreas,
    })
  }, [detectedTechniques, missedOpportunities])

  // Analyze therapist techniques when component mounts or therapist responses change
  useEffect(() => {
    if (therapistResponses.length > 0) {
      analyzeTechniques()
      identifyMissedOpportunities()
      generateFeedbackSummary()
    }
  }, [
    therapistResponses,
    sessionTranscript,
    analyzeTechniques,
    identifyMissedOpportunities,
    generateFeedbackSummary,
  ])

  // Regenerate all feedback
  const regenerateFeedback = () => {
    setIsGenerating(true)
    analyzeTechniques()
    identifyMissedOpportunities()
    generateFeedbackSummary()
  }

  return (
    <Card className='supervisor-feedback border-green-700/20 overflow-hidden shadow-md'>
      <CardHeader className='bg-green-900/10'>
        <CardTitle className='text-green-800 flex items-center justify-between'>
          <span>Clinical Supervisor Feedback</span>
          {feedbackSummary && (
            <Badge
              variant={
                feedbackSummary.overallRating > 7
                  ? 'default'
                  : feedbackSummary.overallRating > 4
                    ? 'secondary'
                    : 'destructive'
              }
            >
              Rating: {feedbackSummary.overallRating}/10
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <div className='bg-green-800/10 flex space-x-1 px-4 py-1'>
        <Button
          variant={activeTab === 'techniques' ? 'default' : 'ghost'}
          size='sm'
          onClick={() => setActiveTab('techniques')}
        >
          Techniques
        </Button>
        <Button
          variant={activeTab === 'opportunities' ? 'default' : 'ghost'}
          size='sm'
          onClick={() => setActiveTab('opportunities')}
        >
          Opportunities
        </Button>
        <Button
          variant={activeTab === 'summary' ? 'default' : 'ghost'}
          size='sm'
          onClick={() => setActiveTab('summary')}
        >
          Summary
        </Button>
      </div>

      <CardContent className='h-[320px] overflow-y-auto p-4'>
        {isGenerating ? (
          <div className='flex h-full items-center justify-center'>
            <div className='animate-pulse text-center'>
              <p className='text-green-800'>Analyzing therapy session...</p>
              <p className='text-green-600 text-sm'>
                Using therapeutic technique recognition
              </p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'techniques' && (
              <div className='techniques-analysis'>
                <h3 className='mb-3 text-lg font-semibold'>
                  Detected Therapeutic Techniques
                </h3>
                {detectedTechniques.length === 0 ? (
                  <p className='text-gray-500 italic'>
                    No therapeutic techniques detected in the session.
                  </p>
                ) : (
                  <div className='space-y-4'>
                    <div className='mb-4 flex flex-wrap gap-2'>
                      {detectedTechniques.map((technique) => (
                        <Badge
                          key={technique.technique}
                          variant={
                            technique.confidence > 0.8 ? 'default' : 'outline'
                          }
                          className='cursor-pointer'
                          onClick={() =>
                            setSelectedTechnique(
                              technique.technique === selectedTechnique
                                ? null
                                : technique.technique,
                            )
                          }
                        >
                          {technique.technique} (
                          {(technique.confidence * 100).toFixed(0)}%)
                        </Badge>
                      ))}
                    </div>

                    {selectedTechnique && (
                      <div className='bg-green-50 rounded-md p-3'>
                        <h4 className='font-medium'>
                          {selectedTechnique} Examples:
                        </h4>
                        <ul className='mt-2 space-y-2'>
                          {detectedTechniques
                            .find((t) => t.technique === selectedTechnique)
                            ?.examples.map((example) => (
                              <li
                                key={`${selectedTechnique}-${example.slice(0, 20)}`}
                                className='text-gray-700 border-green-300 border-l-2 pl-2 text-sm'
                              >
                                &ldquo;{example}&rdquo;
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'opportunities' && (
              <div className='missed-opportunities'>
                <h3 className='mb-3 text-lg font-semibold'>
                  Therapeutic Opportunities
                </h3>
                {missedOpportunities.length === 0 ? (
                  <p className='text-gray-500 italic'>
                    No significant missed opportunities detected.
                  </p>
                ) : (
                  <div className='space-y-4'>
                    {missedOpportunities.map((opportunity) => (
                      <div
                        key={`${opportunity.suggestedTechnique}-${opportunity.context.slice(0, 20)}`}
                        className='bg-blue-50 rounded-md p-3'
                      >
                        <div className='flex justify-between font-medium'>
                          <span>
                            Opportunity for {opportunity.suggestedTechnique}
                          </span>
                          <Badge variant='outline' className='font-normal'>
                            {opportunity.suggestedTechnique}
                          </Badge>
                        </div>
                        <div className='mt-2 text-sm'>
                          <p className='text-gray-700 mb-2 italic'>
                            Client: &ldquo;{opportunity.context}&rdquo;
                          </p>
                          <p className='text-gray-600 mb-2'>
                            {opportunity.rationale}
                          </p>
                          <div className='bg-white border-blue-100 rounded border p-2'>
                            <p className='text-blue-800 text-sm font-medium'>
                              Example response:
                            </p>
                            <p className='text-gray-700'>
                              &ldquo;{opportunity.exampleResponse}&rdquo;
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'summary' && feedbackSummary && (
              <div className='feedback-summary'>
                <h3 className='mb-3 text-lg font-semibold'>
                  Session Assessment
                </h3>

                <div className='space-y-4'>
                  <div>
                    <h4 className='text-green-700 font-medium'>Strengths</h4>
                    <ul className='mt-1 space-y-1'>
                      {feedbackSummary.positivePoints.map((point) => (
                        <li
                          key={point}
                          className='flex items-start gap-2 text-sm'
                        >
                          <span className='text-green-500'>✓</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className='text-amber-700 font-medium'>
                      Development Areas
                    </h4>
                    <ul className='mt-1 space-y-1'>
                      {feedbackSummary.developmentalPoints.map((point) => (
                        <li
                          key={point}
                          className='flex items-start gap-2 text-sm'
                        >
                          <span className='text-amber-500'>→</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className='bg-gray-50 rounded-md p-3'>
                    <h4 className='font-medium'>Supervisor Recommendations</h4>
                    <p className='text-gray-700 mt-1 text-sm'>
                      {feedbackSummary.overallRating > 7
                        ? 'Excellent therapeutic presence. Continue to build on your strengths while incorporating a wider range of techniques.'
                        : feedbackSummary.overallRating > 4
                          ? 'Good foundation of therapeutic skills. Focus on identifying emotional content and responding with appropriate techniques.'
                          : 'Continue developing your therapeutic toolkit. Practice identifying opportunities for validation and reflection.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      <CardFooter className='bg-green-50 border-green-100 flex items-center justify-between border-t'>
        <Button
          variant='outline'
          size='sm'
          onClick={regenerateFeedback}
          disabled={isGenerating}
        >
          Regenerate Feedback
        </Button>
        <p className='text-gray-500 text-xs'>
          Feedback generated based on {therapistResponses.length} therapist
          responses
        </p>
      </CardFooter>
    </Card>
  )
}
