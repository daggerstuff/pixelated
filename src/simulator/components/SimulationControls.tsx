import React from 'react'
import { useSimulator } from '../context/SimulatorContext'

interface SimulationControlsProps {
  className?: string
}

/**
 * Component for controlling simulation features including
 * speech recognition and enhanced feedback models
 */
export const SimulationControls: React.FC<SimulationControlsProps> = ({
  className = '',
}) => {
  const {
    isSpeechRecognitionEnabled,
    toggleSpeechRecognition,
    isUsingEnhancedModels,
    toggleEnhancedModels,
    transcribedText,
    isConnected,
  } = useSimulator()

  return (
    <div className={`simulation-controls ${className}`}>
      <div className="control-panel">
        <h3>Simulation Controls</h3>

        <div className="control-group">
          <label htmlFor="speechRecognitionCheckbox" className="control-label">
            <input
              id="speechRecognitionCheckbox"
              type="checkbox"
              checked={isSpeechRecognitionEnabled}
              onChange={() => toggleSpeechRecognition()}
              disabled={!isConnected}
            />

            <span>Speech Recognition</span>
          </label>
          <p className="control-description">
            Automatically transcribes your speech for enhanced feedback.
          </p>
        </div>

        <div className="control-group">
          <label htmlFor="enhancedModelsCheckbox" className="control-label">
            <input
              id="enhancedModelsCheckbox"
              type="checkbox"
              checked={isUsingEnhancedModels}
              onChange={(e) => toggleEnhancedModels(e.target.checked)}
              disabled={!isConnected}
            />

            <span>Enhanced Healthcare Models</span>
          </label>
          <p className="control-description">
            Uses fine-tuned healthcare models for better therapeutic feedback.
          </p>
        </div>
      </div>

      {isSpeechRecognitionEnabled && transcribedText && (
        <div className="transcription-panel">
          <h4>Speech Transcription</h4>
          <div className="transcription-content">{transcribedText}</div>
        </div>
      )}

      <style>{`
        .simulation-controls {
          background-color: rgba(0, 0, 0, 0.05);
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1rem;
        }

        h3 {
          margin-top: 0;
          font-size: 1.1rem;
          margin-bottom: 1rem;
          color: var(--text-primary);
        }

        .control-group {
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }

        .control-label {
          display: flex;
          align-items: center;
          font-weight: 500;
          margin-bottom: 0.5rem;
          cursor: pointer;
        }

        .control-label input {
          margin-right: 0.5rem;
        }

        .control-description {
          font-size: 0.9rem;
          color: var(--text-secondary);
          margin: 0;
          padding-left: 1.7rem;
        }

        .transcription-panel {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(0, 0, 0, 0.1);
        }

        .transcription-panel h4 {
          font-size: 1rem;
          margin-top: 0;
          margin-bottom: 0.5rem;
        }

        .transcription-content {
          background-color: rgba(255, 255, 255, 0.7);
          padding: 0.7rem;
          border-radius: 4px;
          font-size: 0.9rem;
          max-height: 150px;
          overflow-y: auto;
          white-space: pre-wrap;
        }

        input[type='checkbox']:disabled + span {
          color: var(--text-muted);
        }
      `}</style>
    </div>
  )
}

export default SimulationControls
