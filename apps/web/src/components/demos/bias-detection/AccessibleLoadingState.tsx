import { motion } from 'framer-motion'
// Accessible loading state component with better UX
import React from 'react'

interface AccessibleLoadingStateProps {
  message?: string
  progress?: number
  steps?: string[]
  currentStep?: number
}

export const AccessibleLoadingState: React.FC<AccessibleLoadingStateProps> = ({
  message = 'Analyzing content for bias patterns...',
  progress = 0,
  steps = [
    'Processing content structure',
    'Analyzing demographic patterns',
    'Checking cultural assumptions',
    'Evaluating language bias',
    'Generating recommendations',
  ],
  currentStep = 0,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6 rounded-none border border-border bg-card p-6"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      {/* Main loading message */}
      <div className="space-y-2 text-center">
        <div className="flex justify-center">
          <motion.div
            className="h-8 w-8 rounded-none border-4 border-ring border-t-ring"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            aria-hidden="true"
          />
        </div>
        <h3 className="text-lg font-medium text-foreground">{message}</h3>
        <p className="text-sm text-muted-foreground">
          This may take a few moments for comprehensive analysis
        </p>
      </div>

      {/* Progress bar */}
      {progress > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 w-full rounded-none bg-secondary">
            <motion.div
              className="h-2 rounded-none bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div className="space-y-3">
        {steps.map((step, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{
              opacity: index <= currentStep ? 1 : 0.5,
              x: 0,
            }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center space-x-3"
          >
            <div
              className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-none text-xs font-medium ${
                index < currentStep
                  ? 'bg-primary text-primary-foreground'
                  : index === currentStep
                    ? 'border border-ring bg-secondary font-medium text-foreground'
                    : 'bg-secondary text-muted-foreground'
              }`}
            >
              {index < currentStep ? (
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : index === currentStep ? (
                <motion.div
                  className="h-2 w-2 rounded-none bg-primary"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              ) : (
                index + 1
              )}
            </div>
            <span
              className={`text-sm ${
                index <= currentStep
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {step}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Accessibility features */}
      <div className="sr-only" aria-live="assertive">
        {currentStep < steps.length &&
          `Currently processing: ${steps[currentStep]}`}
      </div>
    </motion.div>
  )
}

export default AccessibleLoadingState
