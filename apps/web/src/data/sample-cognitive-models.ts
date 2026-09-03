// This file contains only static cognitive model definitions for demonstration and testing purposes.
// No actual PHI (Protected Health Information) is processed or handled at runtime in this file.
// Therefore, HIPAA audit logging is not required here.
// If this file is ever used to process real PHI, audit logging must be implemented as per HIPAA compliance.
import type { CognitiveModel } from '@/lib/ai/types/CognitiveModel'
import { anxietyModel } from './sample-cognitive-models.anxiety'
import { depressionModel } from './sample-cognitive-models.depression'
import { traumaModel } from './sample-cognitive-models.trauma'

export const sampleCognitiveModels: CognitiveModel[] = [
  depressionModel,
  anxietyModel,
  traumaModel,
]

export default sampleCognitiveModels