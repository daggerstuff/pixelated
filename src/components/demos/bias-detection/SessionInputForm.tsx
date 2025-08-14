// Custom session input form for bias detection analysis

import React, { useState, useEffect } from 'react'
import type {
  SessionData,
  Demographics,
} from '../../../lib/types/bias-detection'

interface SessionInputFormProps {
  onSubmit: (data: Omit<SessionData, 'sessionId' | 'timestamp'>) => void
  disabled?: boolean
  initialData?: {
    scenario?: string
    demographics: Demographics
    content: string
  }
}

export const SessionInputForm: React.FC<SessionInputFormProps> = ({
  onSubmit,
  disabled = false,
  initialData,
}) => {
  const [formData, setFormData] = useState({
    scenario: initialData?.scenario || '',
    demographics: {
      age: initialData?.demographics.age || '26-35',
      gender: initialData?.demographics.gender || 'female',
      ethnicity: initialData?.demographics.ethnicity || 'white',
      primaryLanguage: initialData?.demographics.primaryLanguage || 'en',
    },
    content: initialData?.content || '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Update form when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData({
        scenario: initialData.scenario || '',
        demographics: initialData.demographics,
        content: initialData.content,
      })
    }
  }, [initialData])

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
  const handleSubmit = (e: React.FormEvent) => {
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
        <label htmlFor="scenario" className="block text-sm font-medium text-gray-700 mb-1">
          Scenario Name (Optional)
        </label>
        <input
          id="scenario"
          type="text"
          value={formData.scenario}
          onChange={(e) => handleInputChange('scenario', e.target.value)}
          disabled={disabled}
          placeholder="e.g., anxiety-treatment, depression-session"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      </div>

      {/* Demographics */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Client Demographics</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Age Group */}
          <div>
            <label htmlFor="age-group" className="block text-sm font-medium text-gray-700 mb-1">
              Age Group
            </label>
            <select
              id="age-group"
              value={formData.demographics.age}
              onChange={(e) => handleDemographicChange('age', e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
              Gender
            </label>
            <select
              id="gender"
              value={formData.demographics.gender}
              onChange={(e) =>
                handleDemographicChange('gender', e.target.value)
              }
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
            <label htmlFor="ethnicity" className="block text-sm font-medium text-gray-700 mb-1">
              Ethnicity
            </label>
            <select
              id="ethnicity"
              value={formData.demographics.ethnicity}
              onChange={(e) =>
                handleDemographicChange('ethnicity', e.target.value)
              }
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
            <label htmlFor="primary-language" className="block text-sm font-medium text-gray-700 mb-1">
              Primary Language
            </label>
            <select
              id="primary-language"
              value={formData.demographics.primaryLanguage}
              onChange={(e) =>
                handleDemographicChange('primaryLanguage', e.target.value)
              }
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
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

      {/* Content */}
      <div>
        <label htmlFor="therapeutic-content" className="block text-sm font-medium text-gray-700 mb-1">
          Therapeutic Content <span className="text-red-500">*</span>
        </label>
        <textarea
          id="therapeutic-content"
          value={formData.content}
          onChange={(e) => handleInputChange('content', e.target.value)}
          disabled={disabled}
          rows={6}
          placeholder="Enter the therapeutic conversation content to analyze for bias patterns..."
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${
            errors['content'] ? 'border-red-300' : 'border-gray-300'
          }`}
        />
        {errors['content'] && (
          <p className="mt-1 text-sm text-red-600">{errors['content']}</p>
        )}
        <p className="mt-1 text-sm text-gray-500">
          {formData.content.length}/1000 characters
        </p>
      </div>

      {/* Example Content Suggestions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h5 className="font-medium text-blue-900 mb-2">
          Example Content Types:
        </h5>
        <ul className="text-sm text-blue-800 space-y-1">
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
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {disabled ? 'Analyzing...' : 'Analyze for Bias'}
        </button>
      </div>

      {/* Character Count Warning */}
      {formData.content.length > 800 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex">
            <svg
              className="h-5 w-5 text-yellow-400 mr-2"
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
              <h4 className="text-sm font-medium text-yellow-800">
                Long Content Notice
              </h4>
              <p className="text-sm text-yellow-700 mt-1">
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
