/**
 * Custom hook for speech recognition with therapeutic enhancements
 * Provides functionality for speech recognition with specialized
 * processing for therapeutic practice
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { SpeechRecognitionConfig } from '../utils/speechRecognition'
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  processRecognizedSpeech,
  DEFAULT_SPEECH_CONFIG,
  createTherapeuticGrammar,
  analyzeTherapeuticTechniques,
} from '../utils/speechRecognition'

interface SpeechRecognitionHookProps {
  domain?: string
  onFinalResult?: (result: {
    text: string
    detectedKeywords: string[]
    confidenceScores: Record<string, number>
    detectedTechniques: Record<string, number>
  }) => void
  onInterimResult?: (text: string) => void
  onError?: (error: string) => void
  autoStart?: boolean
  autoRestart?: boolean
  config?: SpeechRecognitionConfig
}

interface SpeechRecognitionHookResult {
  isListening: boolean
  isSupported: boolean
  transcript: string
  interimTranscript: string
  finalTranscript: string
  detectedKeywords: string[]
  detectedTechniques: Record<string, number>
  error: string | null
  startListening: () => void
  stopListening: () => void
  resetTranscript: () => void
  toggleListening: () => void
}

export function useSpeechRecognition({
  domain = 'general',
  onFinalResult,
  onInterimResult,
  onError,
  autoStart = false,
  autoRestart = true,
  config = DEFAULT_SPEECH_CONFIG,
}: SpeechRecognitionHookProps = {}): SpeechRecognitionHookResult {
  // State for speech recognition
  const [isListening, setIsListening] = useState<boolean>(false)
  const [isSupported, setIsSupported] = useState<boolean>(false)
  const [transcript, setTranscript] = useState<string>('')
  const [interimTranscript, setInterimTranscript] = useState<string>('')
  const [finalTranscript, setFinalTranscript] = useState<string>('')
  const [detectedKeywords, setDetectedKeywords] = useState<string[]>([])
  const [detectedTechniques, setDetectedTechniques] = useState<
    Record<string, number>
  >({})
  const [error, setError] = useState<string | null>(null)

  // Refs for speech recognition
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const listeningRef = useRef<boolean>(false)

  // Add SpeechRecognition interface
  interface SpeechRecognition {
    start(): void
    stop(): void
    onresult: (event: SpeechRecognitionEvent) => void
    onerror: (event: SpeechRecognitionErrorEvent) => void
    onend: () => void
  }

  // Add SpeechRecognitionEvent interface
  interface SpeechRecognitionEvent {
    resultIndex: number
    results: {
      [index: number]: {
        isFinal: boolean
        [index: number]: {
          transcript: string
        }
      }
    }
  }

  // Add SpeechRecognitionErrorEvent interface
  interface SpeechRecognitionErrorEvent {
    error: string
  }

  // Update ref whenever state changes to avoid stale closures
  useEffect(() => {
    listeningRef.current = isListening
  }, [isListening])

  // Setup speech recognition
  useEffect(() => {
    // Check if browser supports speech recognition
    const supported = isSpeechRecognitionSupported()
    setIsSupported(supported)

    if (!supported) {
      setError('Speech recognition is not supported in this browser')
      return
    }

    // Enhance config with therapeutic domain if applicable
    const enhancedConfig = {
      ...config,
    }

    // Add therapeutic grammar if we have the domain
    if (domain) {
      enhancedConfig.grammarList = [createTherapeuticGrammar(domain)]
    }

    // Create speech recognition instance
    recognitionRef.current = createSpeechRecognition(enhancedConfig)

    if (!recognitionRef.current) {
      setError('Failed to initialize speech recognition')
      return
    }

    // Configure speech recognition
    recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = ''
      let interimText = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const { transcript } = event.results[i][0]

        if (event.results[i].isFinal) {
          finalText += transcript + ' '
        } else {
          interimText += transcript
        }
      }

      // Update transcripts
      setInterimTranscript(interimText)

      if (finalText) {
        const newFinalTranscript = finalTranscript + finalText
        setFinalTranscript(newFinalTranscript)

        // Process the final result with therapeutic enhancements
        const {
          processedText,
          detectedKeywords: keywords,
          confidenceScores,
        } = processRecognizedSpeech(finalText, domain)

        // Analyze for therapeutic techniques
        const techniques = analyzeTherapeuticTechniques(finalText)

        // Update state with detected information
        setDetectedKeywords((prev) => [...prev, ...keywords])
        setDetectedTechniques((prev) => ({
          ...prev,
          ...techniques,
        }))

        // Call the provided callback if available
        if (onFinalResult) {
          onFinalResult({
            text: processedText,
            detectedKeywords: keywords,
            confidenceScores,
            detectedTechniques: techniques,
          })
        }
      }

      // Update combined transcript
      setTranscript(finalTranscript + interimText)

      // Call interim result callback if provided
      if (onInterimResult && interimText) {
        onInterimResult(interimText)
      }
    }

    recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorMessage = `Speech recognition error: ${event.error}`
      setError(errorMessage)

      if (onError) {
        onError(errorMessage)
      }
    }

    recognitionRef.current.onend = () => {
      // Only auto-restart if we're still supposed to be listening
      if (listeningRef.current && autoRestart) {
        recognitionRef.current.start()
      } else {
        setIsListening(false)
      }
    }

    // Auto-start if specified
    if (autoStart && !isListening) {
      startListening()
    }

    // Cleanup on unmount
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null
        recognitionRef.current.onerror = null
        recognitionRef.current.onend = null

        if (isListening) {
          recognitionRef.current.stop()
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]) // Only re-initialize when domain changes

  // Start listening function
  const startListening = useCallback(() => {
    if (!isSupported || !recognitionRef.current) {
      setError('Speech recognition is not supported')
      return
    }

    if (isListening) {
      return
    }

    setError(null)

    try {
      recognitionRef.current.start()
      setIsListening(true)
      listeningRef.current = true
    } catch (err: unknown) {
      setError(`Failed to start speech recognition: ${err}`)
      setIsListening(false)
      listeningRef.current = false

      if (onError) {
        onError(`Failed to start speech recognition: ${err}`)
      }
    }
  }, [isListening, isSupported, onError])

  // Stop listening function
  const stopListening = useCallback(() => {
    if (!isListening || !recognitionRef.current) {
      return
    }

    try {
      recognitionRef.current.stop()
      setIsListening(false)
      listeningRef.current = false
    } catch (err: unknown) {
      setError(`Failed to stop speech recognition: ${err}`)

      if (onError) {
        onError(`Failed to stop speech recognition: ${err}`)
      }
    }
  }, [isListening, onError])

  // Reset transcript function
  const resetTranscript = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
    setFinalTranscript('')
    setDetectedKeywords([])
    setDetectedTechniques({})
  }, [])

  // Toggle listening function
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    finalTranscript,
    detectedKeywords,
    detectedTechniques,
    error,
    startListening,
    stopListening,
    resetTranscript,
    toggleListening,
  }
}
