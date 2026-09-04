/**
 * FeedbackService types — extracted from FeedbackService.ts.
 */

export type AudioProcessorMessage = {
  type: 'audioData'
  data: Float32Array
  metadata: { timestamp: number }
}

export interface MentalHealthInsights {
  hasMentalHealthIssue: boolean
  mentalHealthCategory?: string | null
  explanation?: string
  supportingEvidence?: string[]
}
