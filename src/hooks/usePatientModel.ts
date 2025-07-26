import { useState, useEffect, useCallback } from 'react'
import { KVStore } from '@/lib/db/KVStore'
import {
  PatientModelService,
  type ModelIdentifier,
} from '@/lib/ai/services/PatientModelService'
import type {
  CognitiveModel,
  PatientResponseStyleConfig,
} from '@/lib/ai/types/CognitiveModel'

export function usePatientModel() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [patientService, setPatientService] =
    useState<PatientModelService | null>(null)
  const [availableModels, setAvailableModels] = useState<ModelIdentifier[]>([])
  const [currentModelId, setCurrentModelId] = useState<string | null>(null)
  const [currentModel, setCurrentModel] = useState<CognitiveModel | null>(null)
  const [styleConfig, setStyleConfig] = useState<PatientResponseStyleConfig>({
    openness: 5,
    coherence: 7,
    defenseLevel: 5,
    disclosureStyle: 'selective',
    challengeResponses: 'curious',
  })

  // Initialize the patient model service
  useEffect(() => {
    const kvStore = new KVStore('cognitive_models_', true)
    const service = new PatientModelService(kvStore)
    setPatientService(service)

    // Load available models
    const loadModels = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const models = await service.getAvailableModels()
        setAvailableModels(models)

        // If models exist and no current model selected, select the first one
        if (models.length > 0 && !currentModelId) {
          setCurrentModelId(models[0].id)
        }
      } catch (err) {
        console.error('Failed to load patient models:', err)
        setError('Failed to load available patient models')
      } finally {
        setIsLoading(false)
      }
    }

    loadModels()
  }, [currentModelId])

  // Load the selected model when currentModelId changes
  useEffect(() => {
    if (!patientService || !currentModelId) {
      return
    }

    const loadModel = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const model = await patientService.getModelById(currentModelId)

        if (model) {
          setCurrentModel(model)
        } else {
          setError(`Could not load patient model with ID: ${currentModelId}`)
        }
      } catch (err) {
        console.error(`Failed to load patient model ${currentModelId}:`, err)
        setError(
          `Error loading patient model: ${err instanceof Error ? err.message : String(err)}`,
        )
      } finally {
        setIsLoading(false)
      }
    }

    loadModel()
  }, [patientService, currentModelId])

  // Select a different patient model
  const selectModel = useCallback((modelId: string) => {
    setCurrentModelId(modelId)
  }, [])

  // Update the style configuration
  const updateStyleConfig = useCallback(
    (newConfig: Partial<PatientResponseStyleConfig>) => {
      setStyleConfig((prevConfig) => ({
        ...prevConfig,
        ...newConfig,
      }))
    },
    [],
  )

  // Generate a patient response
  const generatePatientResponse = useCallback(
    async (
      conversationHistory: Array<{
        role: 'therapist' | 'patient'
        content: string
      }>,
      currentTherapeuticFocus?: string[],
      sessionNumber: number = 1,
    ) => {
      if (!patientService || !currentModelId || !currentModel) {
        throw new Error(
          'Patient model service not initialized or no model selected',
        )
      }

      try {
        // Create response context
        const responseContext = await patientService.createResponseContext(
          currentModelId,
          conversationHistory,
          styleConfig,
          currentTherapeuticFocus,
          sessionNumber,
        )

        if (!responseContext) {
          throw new Error('Failed to create response context')
        }

        // Generate prompt for LLM
        const prompt = patientService.generatePatientPrompt(responseContext)

        // At this point, you would send this prompt to your LLM service
        // For now, we'll just return the prompt
        return {
          prompt,
          context: responseContext,
        }
      } catch (err) {
        console.error('Failed to generate patient response:', err)
        throw err
      }
    },
    [patientService, currentModelId, currentModel, styleConfig],
  )

  return {
    isLoading,
    error,
    availableModels,
    currentModelId,
    currentModel,
    styleConfig,
    selectModel,
    updateStyleConfig,
    generatePatientResponse,
  }
}
