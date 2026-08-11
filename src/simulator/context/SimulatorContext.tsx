import React, {
  createContext,
  useContext,
  useReducer,
} from 'react'

import type {
  SimulatorState,
  SimulatorProviderProps,
  EmotionState,
  SpeechPattern,
  DetectedTechnique,
} from '../types'

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type SimulatorAction =
  | { type: 'START_SIMULATION' }
  | { type: 'STOP_SIMULATION' }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_CONNECTION_STATUS'; payload: 'connected' | 'disconnected' | 'connecting' }
  | { type: 'SET_CONSENT'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_EMOTION_STATE'; payload: EmotionState }
  | { type: 'SET_SPEECH_PATTERNS'; payload: SpeechPattern[] }
  | { type: 'SET_DETECTED_TECHNIQUES'; payload: DetectedTechnique[] }
  | { type: 'RESET' }

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

const initialState: SimulatorState = {
  isRunning: false,
  isProcessing: false,
  hasConsent: false,
  error: null,
  emotionState: null,
  speechPatterns: [],
  detectedTechniques: [],
  connectionStatus: 'disconnected',
}

function simulatorReducer(
  state: SimulatorState,
  action: SimulatorAction,
): SimulatorState {
  switch (action.type) {
    case 'START_SIMULATION':
      return { ...state, isRunning: true, error: null }
    case 'STOP_SIMULATION':
      return { ...state, isRunning: false, isProcessing: false }
    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.payload }
    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.payload }
    case 'SET_CONSENT':
      return { ...state, hasConsent: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'UPDATE_EMOTION_STATE':
      return { ...state, emotionState: action.payload }
    case 'SET_SPEECH_PATTERNS':
      return { ...state, speechPatterns: action.payload }
    case 'SET_DETECTED_TECHNIQUES':
      return { ...state, detectedTechniques: action.payload }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface SimulatorContextValue {
  state: SimulatorState
  dispatch: React.Dispatch<SimulatorAction>
}

const SimulatorContext = createContext<SimulatorContextValue | undefined>(
  undefined,
)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SimulatorProvider({
  children,
  initialState: initialStateOverride,
}: SimulatorProviderProps) {
  const [state, dispatch] = useReducer(
    simulatorReducer,
    { ...initialState, ...initialStateOverride },
  )

  return (
    <SimulatorContext.Provider value={{ state, dispatch }}>
      {children}
    </SimulatorContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useSimulatorContextValue(): SimulatorContextValue {
  const context = useContext(SimulatorContext)
  if (!context) {
    throw new Error(
      'useSimulator or useSimulatorContext must be used within a SimulatorProvider',
    )
  }
  return context
}

export function useSimulator() {
  return useSimulatorContextValue()
}

export function useSimulatorContext() {
  return useSimulatorContextValue()
}
