import { useState } from 'react'
import type { FunnelConfig } from '../../hooks/useConversionTracking'
import useConversionTracking from '../../hooks/useConversionTracking'

// Example component to demonstrate conversion tracking
export default function ConversionTrackingExample() {
  const [step, setStep] = useState(0)

  // Define a funnel config to track a multi-step process
  const funnelConfig: FunnelConfig = {
    id: 'signup-funnel',
    stages: [
      { id: 'step1', index: 0 },
      { id: 'step2', index: 1 },
      { id: 'step3', index: 2 },
      { id: 'completed', index: 3 },
    ],
  }

  // Initialize the hook with our funnel configuration
  const { trackEvent, trackConversion, trackFunnelStage } =
    useConversionTracking({
      funnels: [funnelConfig],
    })

  // Handle moving to next step
  const nextStep = () => {
    const newStep = step + 1
    setStep(newStep)

    // Track the funnel stage progress
    if (newStep < funnelConfig.stages.length) {
      const nextStage = funnelConfig.stages[newStep]
      if (nextStage) {
        trackFunnelStage(funnelConfig.id, nextStage.id)
      }
    }

    // If reaching the final step, track a conversion
    if (newStep === funnelConfig.stages.length - 1) {
      trackConversion('signup-complete')
    }
  }

  // Track a simple event
  const handleSimpleEvent = () => {
    trackEvent('button-clicked', { buttonType: 'example' })
  }

  // Reset the demo
  const resetDemo = () => {
    setStep(0)
    const firstStage = funnelConfig.stages[0]
    if (firstStage) {
      trackFunnelStage(funnelConfig.id, firstStage.id)
    }
  }

  return (
    <div className="conversion-example">
      <div className="progress-bar">
        {funnelConfig.stages.map((stage, idx) => (
          <div
            key={stage.id}
            className={`progress-step ${idx <= step ? 'active' : ''}`}
          >
            {stage.id}
          </div>
        ))}
      </div>

      <div className="content">
        {step < funnelConfig.stages.length - 1 ? (
          <div className="step-content">
            <h3>
              Step {step + 1}: {funnelConfig.stages[step]?.id || 'Unknown'}
            </h3>
            <p>This is step {step + 1} of the funnel.</p>
            <button onClick={nextStep}>Next Step</button>
          </div>
        ) : (
          <div className="completion">
            <h3>Conversion Complete!</h3>
            <p>You&apos;ve completed all steps of the funnel.</p>
            <button onClick={resetDemo}>Start Over</button>
          </div>
        )}
      </div>

      <div className="side-actions">
        <h4>Other Actions</h4>
        <button onClick={handleSimpleEvent}>Track Simple Event</button>
        <div className="event-info">
          <p>
            Click the button above to track a single event without affecting the
            funnel.
          </p>
        </div>
      </div>

      <style>{`
        .conversion-example {
          font-family: system-ui, sans-serif;
        }

        .progress-bar {
          display: flex;
          margin-bottom: 1.5rem;
        }

        .progress-step {
          flex: 1;
          text-align: center;
          padding: 0.5rem;
          background: #eee;
          margin-right: 4px;
          border-radius: 4px;
          font-size: 0.8rem;
          text-transform: uppercase;
        }

        .progress-step.active {
          background: #4f46e5;
          color: white;
        }

        .step-content,
        .completion {
          background: #f9f9f9;
          padding: 1.5rem;
          border-radius: 0.5rem;
          margin-bottom: 1.5rem;
        }

        .completion {
          background: #ecfdf5;
          border: 1px solid #10b981;
        }

        button {
          background: #4f46e5;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 0.25rem;
          cursor: pointer;
          font-size: 0.9rem;
        }

        button:hover {
          background: #4338ca;
        }

        .side-actions {
          background: #f9f9f9;
          padding: 1rem;
          border-radius: 0.5rem;
        }

        .event-info {
          margin-top: 0.5rem;
          font-size: 0.8rem;
          color: #666;
        }
      `}</style>
    </div>
  )
}
