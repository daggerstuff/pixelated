import { useState, useEffect, useRef, useCallback } from 'react'

import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('speech-recognition')

/**
 * Custom hook for managing the Web Speech API lifecycle in a therapeutic simulator context.
 *
 * Orchestrates the browser speech recognition engine and therapeutic grammar lists.
 * Keeps high-frequency updates scoped locally to limit broader rerender impact during frequent interim results.
 *
 * DESIGN RATIONALE:
 * - Direct orchestration of window.SpeechRecognition avoids complex state synchronization issues
 * - Local transcript state prevents top-level context re-renders on every word detection
 * - Error handling specifically accounts for microphone permission and browser support constraints
 */
export function useSpeechRecognition() {
  const [isListening, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [detectedTechniques, setDetectedTechniques] = useState<string[]>([])
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    // Check for browser support
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      logger.warn('Web Speech API is not supported in this browser')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsProcessing(true)
      logger.info('Speech recognition started')
    }

    recognition.onresult = (event: any) => {
      let interimTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          setTranscript((prev) => prev + event.results[i][0].transcript)
        } else {
          interimTranscript += event.results[i][0].transcript
        }
      }
      // Log high-frequency interim updates locally without triggering broad re-renders
      if (interimTranscript) {
        logger.debug('Interim result:', { interimTranscript })
      }
    }

    recognition.onerror = (event: any) => {
      logger.error('Speech recognition error', { error: event.error })
      setIsProcessing(false)
    }

    recognition.onend = () => {
      setIsProcessing(false)
      logger.info('Speech recognition ended')
    }

    recognitionRef.current = recognition

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript('')
      try {
        recognitionRef.current.start()
      } catch (err) {
        logger.error('Failed to start recognition', { err })
      }
    }
  }, [isListening])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
    }
  }, [isListening])

  return {
    isListening,
    transcript,
    detectedTechniques,
    startListening,
    stopListening,
  }
}
