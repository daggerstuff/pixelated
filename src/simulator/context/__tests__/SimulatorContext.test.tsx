import { renderHook, act } from '@testing-library/react'
import {
  SimulatorProvider,
  useSimulator,
  initialState,
} from '../SimulatorContext'
import type {
  EmotionState,
  SpeechPattern,
  DetectedTechnique,
} from '../../types'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SimulatorProvider>{children}</SimulatorProvider>
)

describe('SimulatorContext', () => {
  it('should throw error when useSimulator is used outside of SimulatorProvider', () => {
    expect(() => renderHook(() => useSimulator())).toThrow(
      'useSimulator must be used within a SimulatorProvider',
    )
  })

  it('should provide initial state', () => {
    const { result } = renderHook(() => useSimulator(), { wrapper })

    expect(result.current.state).toEqual({
      isRunning: false,
      isProcessing: false,
      hasConsent: false,
      error: null,
      emotionState: null,
      speechPatterns: [],
      detectedTechniques: [],
      connectionStatus: 'disconnected',
    })
  })

  it('should start simulation', () => {
    const { result } = renderHook(() => useSimulator(), { wrapper })

    act(() => {
      result.current.dispatch({ type: 'START_SIMULATION' })
    })
    expect(result.current.state.isRunning).toBe(true)

    act(() => {
      result.current.dispatch({ type: 'STOP_SIMULATION' })
    })
    expect(result.current.state.isRunning).toBe(false)
  })

  it('should update emotion state', () => {
    const { result } = renderHook(() => useSimulator(), { wrapper })

    const newEmotionState: EmotionState = {
      valence: 0.8,
      energy: 0.6,
      dominance: 0.4,
    }

    act(() => {
      result.current.dispatch({
        type: 'UPDATE_EMOTION_STATE',
        payload: newEmotionState,
      })
    })

    expect(result.current.state.emotionState).toEqual(newEmotionState)
  })

  it('should add speech pattern', () => {
    const { result } = renderHook(() => useSimulator(), { wrapper })

    const pattern: SpeechPattern = {
      pattern: 'pattern1',
      confidence: 0.8,
      timestamp: Date.now(),
    }
    act(() => {
      result.current.dispatch({ type: 'ADD_SPEECH_PATTERN', payload: pattern })
    })

    expect(result.current.state.speechPatterns).toContainEqual(pattern)
  })

  it('should add detected technique', () => {
    const { result } = renderHook(() => useSimulator(), { wrapper })

    const technique: DetectedTechnique = {
      name: 'technique1',
      description: 'Test technique',
      confidence: 0.9,
      timestamp: Date.now(),
    }
    act(() => {
      result.current.dispatch({
        type: 'ADD_DETECTED_TECHNIQUE',
        payload: technique,
      })
    })

    expect(result.current.state.detectedTechniques).toContainEqual(technique)
  })

  it('should handle connection status changes', () => {
    const { result } = renderHook(() => useSimulator(), { wrapper })

    act(() => {
      result.current.dispatch({
        type: 'SET_CONNECTION_STATUS',
        payload: 'connecting',
      })
    })

    expect(result.current.state.connectionStatus).toBe('connecting')

    act(() => {
      result.current.dispatch({
        type: 'SET_CONNECTION_STATUS',
        payload: 'connected',
      })
    })

    expect(result.current.state.connectionStatus).toBe('connected')
  })

  it('should reset state', () => {
    const { result } = renderHook(() => useSimulator(), { wrapper })

    // First make some changes to the state
    act(() => {
      result.current.dispatch({ type: 'START_SIMULATION' })
      result.current.dispatch({ type: 'SET_PROCESSING', payload: true })
      result.current.dispatch({
        type: 'UPDATE_EMOTION_STATE',
        payload: { valence: 0.5, energy: 0.5, dominance: 0.5 },
      })
    })

    // Then reset
    act(() => {
      result.current.dispatch({ type: 'RESET_STATE' })
    })

    expect(result.current.state).toEqual(initialState)
  })

  it('manages processing state', () => {
    const { result } = renderHook(() => useSimulator(), { wrapper })

    act(() => {
      result.current.dispatch({ type: 'SET_PROCESSING', payload: true })
    })
    expect(result.current.state.isProcessing).toBe(true)

    act(() => {
      result.current.dispatch({ type: 'SET_PROCESSING', payload: false })
    })
    expect(result.current.state.isProcessing).toBe(false)
  })

  it('updates consent status', () => {
    const { result } = renderHook(() => useSimulator(), { wrapper })

    act(() => {
      result.current.dispatch({ type: 'SET_CONSENT', payload: true })
    })
    expect(result.current.state.hasConsent).toBe(true)

    act(() => {
      result.current.dispatch({ type: 'SET_CONSENT', payload: false })
    })
    expect(result.current.state.hasConsent).toBe(false)
  })

  it('maintains state consistency across multiple updates', () => {
    const { result } = renderHook(() => useSimulator(), { wrapper })

    act(() => {
      result.current.dispatch({ type: 'START_SIMULATION' })
      result.current.dispatch({ type: 'SET_PROCESSING', payload: true })
      result.current.dispatch({
        type: 'UPDATE_EMOTION_STATE',
        payload: { valence: 0.5, energy: 0.5, dominance: 0.5 },
      })
    })

    expect(result.current.state).toEqual({
      isRunning: true,
      isProcessing: true,
      hasConsent: false,
      error: null,
      emotionState: { valence: 0.5, energy: 0.5, dominance: 0.5 },
      speechPatterns: [],
      detectedTechniques: [],
      connectionStatus: 'disconnected',
    })
  })
})
