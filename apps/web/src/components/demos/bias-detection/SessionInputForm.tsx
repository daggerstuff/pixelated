// Custom session input form for bias detection analysis

import React, { useState, type FC, SyntheticEvent } from 'react'

import type {
  SessionData,
  Demographics,
} from '../../../lib/types/bias-detection'
import { RealTimeBiasIndicator } from './RealTimeBiasIndicator'

interface SessionInputFormProps {
  onSubmit: (data: Omit<SessionData, 'sessionId' | 'timestamp'>) => void
  disabled?: boolean
  initialData?: {
    scenario?: string
    demographics: Demographics
    content: string
  }
}

export const SessionInputForm: FC<SessionInputFormProps> = ({
  onSubmit,
  disabled = false,
  initialData,
}) => {
  const [formData, setFormData] = useState({
    scenario: initialData?.scenario ?? '',
    demographics: {
      age: initialData?.demographics.age ?? '26-35',
      gender: initialData?.demographics.gender ?? 'female',
      ethnicity: initialData?.demographics.ethnicity ?? 'white',
      primaryLanguage: initialData?.demographics.primaryLanguage ?? 'en',
    },
    content: initialData?.content ?? '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [previousInitialData, setPreviousInitialData] = useState(initialData)

  if (initialData && initialData !== previousInitialData) {
    setPreviousInitialData(initialData)
    setFormData({
      scenario: initialData.scenario ?? '',
      demographics: initialData.demographics,
      content: initialData.content,
    })
  }

  // Validation
  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData['content'].trim()) {
      newErrors['content'] = 'Content is required'
    } else if (formData['content'].trim().length < 10) {
      newErrors['content'] = 'Content must be at least 10 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle form submission
  const handleSubmit = (e: SyntheticEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    onSubmit({
      scenario: formData.scenario || '',
      demographics: formData.demographics,
      content: formData['content'].trim(),
    })
  }

  // Handle input changes
  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: '',
      }))
    }
  }

  const handleDemographicChange = (
    field: keyof Demographics,
    value: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      demographics: {
        ...prev.demographics,
        [field]: value,
      },
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="session-input-form space-y-4">
      {/* Scenario Name (Optional) */}
      <div>
        <label
          htmlFor="scenario"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          Scenario Name (Optional)
        </label>
        <input
          id="scenario"
          type="text"
          value={formData.scenario}
          onChange={(e) => handleInputChange('scenario', e.target.value)}
          disabled={disabled}
          placeholder="e.g., anxiety-treatment, depression-session"
          className="w-full rounded-none border border-input px-3 py-2 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-35"
        />
      </div>

      {/* Demographics */}
      <div className="rounded-none bg-secondary p-4">
        <h4 className="mb-3 font-medium text-foreground">
          Client Demographics
        </h4>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Age Group */}
          <div>
            <label
              htmlFor="age-group"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Age Group
            </label>
            <select
              id="age-group"
              value={formData.demographics.age}
              onChange={(e) => handleDemographicChange('age', e.target.value)}
              disabled={disabled}
              className="w-full rounded-none border border-input px-3 py-2 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-35"
            >
              <option value="18-25">18-25</option>
              <option value="26-35">26-35</option>
              <option value="36-45">36-45</option>
              <option value="46-55">46-55</option>
              <option value="56-65">56-65</option>
              <option value="65+">65+</option>
            </select>
          </div>

          {/* Gender */}
          <div>
            <label
              htmlFor="gender"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Gender
            </label>
            <select
              id="gender"
              value={formData.demographics.gender}
              onChange={(e) =>
                handleDemographicChange('gender', e.target.value)
              }
              disabled={disabled}
              className="w-full rounded-none border border-input px-3 py-2 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-35"
            >
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="non-binary">Non-binary</option>
              <option value="other">Other</option>
              <option value="prefer-not-to-say">Prefer not to say</option>
            </select>
          </div>

          {/* Ethnicity */}
          <div>
            <label
              htmlFor="ethnicity"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Ethnicity
            </label>
            <select
              id="ethnicity"
              value={formData.demographics.ethnicity}
              onChange={(e) =>
                handleDemographicChange('ethnicity', e.target.value)
              }
              disabled={disabled}
              className="w-full rounded-none border border-input px-3 py-2 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-35"
            >
              <option value="white">White</option>
              <option value="black">Black/African American</option>
              <option value="hispanic">Hispanic/Latino</option>
              <option value="asian">Asian</option>
              <option value="native-american">Native American</option>
              <option value="pacific-islander">Pacific Islander</option>
              <option value="mixed">Mixed/Multiracial</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Primary Language */}
          <div>
            <label
              htmlFor="primary-language"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Primary Language
            </label>
            <select
              id="primary-language"
              value={formData.demographics.primaryLanguage}
              onChange={(e) =>
                handleDemographicChange('primaryLanguage', e.target.value)
              }
              disabled={disabled}
              className="w-full rounded-none border border-input px-3 py-2 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-35"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="pt">Portuguese</option>
              <option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
              <option value="ar">Arabic</option>
              <option value="hi">Hindi</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content with Real-time Bias Analysis */}
      <div className="space-y-4">
        <div>
          <label
            htmlFor="therapeutic-content"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            Therapeutic Content <span className="text-foreground">*</span>
          </label>
          <textarea
            id="therapeutic-content"
            value={formData.content}
            onChange={(e) => handleInputChange('content', e.target.value)}
            disabled={disabled}
            rows={6}
            placeholder="Enter the therapeutic conversation content to analyze for bias patterns..."
            className={`w-full rounded-none border px-3 py-2 transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-35 ${
              errors['content'] ? 'border-ring' : 'border-input'
            }`}
          />
          {errors['content'] && (
            <p className="mt-1 text-sm font-semibold text-foreground">
              {errors['content']}
            </p>
          )}
          <div className="mt-1 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {formData.content.length}/1000 characters
            </p>
            {formData.content.length >= 10 && (
              <div className="flex items-center space-x-1 text-xs text-foreground">
                <div className="h-2 w-2 animate-pulse rounded-none bg-primary"></div>
                <span>Live analysis active</span>
              </div>
            )}
          </div>
        </div>

        {/* Real-time Bias Indicator */}
        <RealTimeBiasIndicator
          content={formData.content}
          demographics={formData.demographics}
        />
      </div>

      {/* Example Content Suggestions */}
      <div className="rounded-none border border-input bg-secondary p-4">
        <h5 className="mb-2 font-medium text-foreground">
          Example Content Types:
        </h5>
        <ul className="space-y-1 text-sm text-foreground">
          <li>• Therapist-client dialogue with potential bias patterns</li>
          <li>• Treatment recommendations that may show demographic bias</li>
          <li>
            • Assessment questions that could contain cultural assumptions
          </li>
          <li>
            • Intervention strategies that may not be culturally appropriate
          </li>
        </ul>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={disabled || !formData.content.trim()}
          className="rounded-none bg-primary px-6 py-2 font-medium text-primary-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-35"
        >
          {disabled ? 'Analyzing...' : 'Analyze for Bias'}
        </button>
      </div>

      {/* Character Count Warning */}
      {formData.content.length > 800 && (
        <div className="rounded-none border border-ring bg-secondary p-3">
          <div className="flex">
            <svg
              className="mr-2 h-5 w-5 text-foreground"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-foreground">
                Long Content Notice
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Very long content may take longer to analyze and could affect
                accuracy.
              </p>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}

export default SessionInputForm
