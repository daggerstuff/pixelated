// Accessible loading state component with better UX
import React from 'react'
import { motion } from 'framer-motion'

interface AccessibleLoadingStateProps {
  message?: string
  progress?: number
  steps?: string[]
  currentStep?: number
}

export const AccessibleLoadingState: React.FC<AccessibleLoadingStateProps> = ({
  message = "Analyzing content for bias patterns...",
  progress = 0,
  steps = [
    "Processing content structure",
    "Analyzing demographic patterns", 
    "Checking cultural assumptions",
    "Evaluating language bias",
    "Generating recommendations"
  ],
  currentStep = 0
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-lg border border-gray-200 p-6 space-y-6"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      {/* Main loading message */}
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <motion.div
            className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            aria-hidden="true"
          />
        </div>
        <h3 className="text-lg font-medium text-gray-900">{message}</h3>
        <p className="text-sm text-gray-600">
          This may take a few moments for comprehensive analysis
        </p>
      </div>

      {/* Progress bar */}
      {progress > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <motion.div
              className="bg-blue-600 h-2 rounded-full"
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
              x: 0 
            }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center space-x-3"
          >
            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              index < currentStep 
                ? 'bg-green-100 text-green-800' 
                : index === currentStep 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              {index < currentStep ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : index === currentStep ? (
                <motion.div
                  className="w-2 h-2 bg-blue-600 rounded-full"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              ) : (
                index + 1
              )}
            </div>
            <span className={`text-sm ${
              index <= currentStep ? 'text-gray-900' : 'text-gray-500'
            }`}>
              {step}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Accessibility features */}
      <div className="sr-only" aria-live="assertive">
        {currentStep < steps.length && (
          `Currently processing: ${steps[currentStep]}`
        )}
      </div>
    </motion.div>
  )
}

export default AccessibleLoadingState