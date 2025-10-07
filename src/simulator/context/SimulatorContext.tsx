import type { ReactNode } from 'react'
import React, { createContext, useContext, useReducer } from 'react'
import type {
  SimulatorState,
  EmotionState,
  SpeechPattern,
  DetectedTechnique,
} from '../types'

// Define action types
type SimulatorAction =
  | { type: 'START_SIMULATION' }
  | { type: 'STOP_SIMULATION' }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_CONSENT'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_EMOTION_STATE'; payload: EmotionState }
  | { type: 'ADD_SPEECH_PATTERN'; payload: SpeechPattern }
  | { type: 'ADD_DETECTED_TECHNIQUE'; payload: DetectedTechnique }
  | {
      type: 'SET_CONNECTION_STATUS'
      payload: 'connected' | 'disconnected' | 'connecting'
    }
  | { type: 'RESET_STATE' }

// Initial state
export const initialState: SimulatorState = {
  isRunning: false,
  isProcessing: false,
  hasConsent: false,
  error: null,
  emotionState: null,
  speechPatterns: [],
  detectedTechniques: [],
  connectionStatus: 'disconnected',
}

// Create context
const SimulatorContext = createContext<
  | {
      state: SimulatorState
      dispatch: React.Dispatch<SimulatorAction>
    }
  | undefined
>(undefined)

// Reducer function
function simulatorReducer(
  state: SimulatorState,
  action: SimulatorAction,
): SimulatorState {
  switch (action.type) {
    case 'START_SIMULATION':
      return { ...state, isRunning: true, error: null }
    case 'STOP_SIMULATION':
      return { ...state, isRunning: false }
    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.payload }
    case 'SET_CONSENT':
      return { ...state, hasConsent: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload, isRunning: false }
    case 'UPDATE_EMOTION_STATE':
      return { ...state, emotionState: action.payload }
    case 'ADD_SPEECH_PATTERN':
      return {
        ...state,
        speechPatterns: [...state.speechPatterns, action.payload],
      }
    case 'ADD_DETECTED_TECHNIQUE':
      return {
        ...state,
        detectedTechniques: [...state.detectedTechniques, action.payload],
      }
    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.payload }
    case 'RESET_STATE':
      return initialState
    default:
      return state
  }
}

interface SimulatorProviderProps {
  children: ReactNode
  initialState?: Partial<SimulatorState>
}

// Provider component
export function SimulatorProvider({
  children,
  initialState: customInitialState,
}: SimulatorProviderProps) {
  const [state, dispatch] = useReducer(simulatorReducer, {
    ...initialState,
    ...customInitialState,
  })

  return (
    <SimulatorContext.Provider value={{ state, dispatch }}>
      {children}
    </SimulatorContext.Provider>
  )
}

// Custom hook for using the simulator context
export function useSimulator() {
  const context = useContext(SimulatorContext)
  if (context === undefined) {
    throw new Error('useSimulator must be used within a SimulatorProvider')
  }
  return context
}

// Export the hook with the name components are expecting
export const useSimulatorContext = useSimulator
