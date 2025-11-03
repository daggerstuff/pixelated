import React, { useState, useCallback, useRef } from 'react'
import { InputValidator } from '@/middleware/security'

interface BiasDetectionFormProps {
  onSubmit: (data: BiasAnalysisRequest) => Promise<void>
  isLoading?: boolean
  maxLength?: number
}

interface BiasAnalysisRequest {
  text: string
  context: string
  demographics: {
    gender: string
    ethnicity: string
    age: string
    primaryLanguage: string
  }
  sessionType: string
  therapistNotes?: string
}

interface DemographicsErrors {
  gender?: string
  ethnicity?: string
  age?: string
  primaryLanguage?: string
}

interface FormErrors {
  text?: string
  context?: string
  demographics?: DemographicsErrors
  submit?: string
}

export const BiasDetectionForm: React.FC<BiasDetectionFormProps> = ({
  onSubmit,
  isLoading = false,
  maxLength = 10000,
}) => {
  const [formData, setFormData] = useState<BiasAnalysisRequest>({
    text: '',
    context: '',
    demographics: {
      gender: '',
      ethnicity: '',
      age: '',
      primaryLanguage: '',
    },
    sessionType: 'individual',
    therapistNotes: '',
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [characterCount, setCharacterCount] = useState(0)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {}

    // Required field validation
    if (!formData.text.trim()) {
      newErrors.text = 'Therapy session text is required'
    } else if (formData.text.length < 50) {
      newErrors.text = 'Please provide at least 50 characters of session text'
    } else if (formData.text.length > maxLength) {
      newErrors.text = `Text exceeds maximum length of ${maxLength} characters`
    }

    if (!formData.context.trim()) {
      newErrors.context = 'Session context is required'
    }

    // Demographics validation
    const demographicsErrors: DemographicsErrors = {}
    if (!formData.demographics.gender) {
      demographicsErrors.gender = 'Gender selection is required'
    }
    if (!formData.demographics.ethnicity) {
      demographicsErrors.ethnicity = 'Ethnicity selection is required'
    }
    if (!formData.demographics.age) {
      demographicsErrors.age = 'Age group selection is required'
    }
    if (!formData.demographics.primaryLanguage) {
      demographicsErrors.primaryLanguage = 'Primary language is required'
    }

    if (Object.keys(demographicsErrors).length > 0) {
      newErrors.demographics = demographicsErrors
    }

    const sanitizedText = InputValidator.sanitizeString(formData.text)

    if (sanitizedText !== formData.text) {
      newErrors.text =
        'Text contains potentially harmful content that has been sanitized'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData, maxLength])

  const handleTextChange = useCallback(
    (value: string) => {
      setFormData((prev) => ({ ...prev, text: value }))
      setCharacterCount(value.length)

      if (errors.text) {
        setErrors((prev) => ({ ...prev, text: undefined }))
      }
    },
    [errors.text],
  )

  const handleDemographicsChange = useCallback(
    (field: keyof BiasAnalysisRequest['demographics'], value: string) => {
      setFormData((prev) => ({
        ...prev,
        demographics: {
          ...prev.demographics,
          [field]: value,
        },
      }))

      // Clear demographics error when user makes selection
      if (errors.demographics?.[field]) {
        setErrors((prev) => ({
          ...prev,
          demographics: {
            ...prev.demographics,
            [field]: undefined,
          },
        }))
      }
    },
    [errors.demographics],
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!validateForm()) {
        // Focus first error field
        const firstErrorField = Object.keys(errors)[0]
        if (firstErrorField === 'text' && textAreaRef.current) {
          textAreaRef.current.focus()
        }
        return
      }

      try {
        await onSubmit({
          ...formData,
          text: InputValidator.sanitizeString(formData.text),
          context: InputValidator.sanitizeString(formData.context),
          therapistNotes: formData.therapistNotes
            ? InputValidator.sanitizeString(formData.therapistNotes)
            : undefined,
        })
      } catch (error) {
        console.error('Form submission error:', error)
        setErrors({ submit: 'Failed to submit analysis. Please try again.' })
      }
    },
    [formData, validateForm, onSubmit, errors],
  )

  const clearForm = useCallback(() => {
    setFormData({
      text: '',
      context: '',
      demographics: {
        gender: '',
        ethnicity: '',
        age: '',
        primaryLanguage: '',
      },
      sessionType: 'individual',
      therapistNotes: '',
    })
    setErrors({})
    setCharacterCount(0)
  }, [])

  return (
    <div className="bias-detection-form">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Session Text */}
        <div className="form-group">
          <label htmlFor="session-text" className="form-label">
            Therapy Session Text *
            <span className="text-sm text-gray-400 ml-2">
              ({characterCount}/{maxLength} characters)
            </span>
          </label>
          <textarea
            id="session-text"
            ref={textAreaRef}
            value={formData.text}
            onChange={(e) => handleTextChange(e.target.value)}
            className={`form-textarea ${errors.text ? 'error' : ''}`}
            placeholder="Paste or type the therapy session transcript here..."
            rows={8}
            maxLength={maxLength}
            disabled={isLoading}
          />
          {errors.text && <div className="form-error">{errors.text}</div>}
          <div className="text-sm text-gray-400 mt-1">
            Include therapist-patient dialogue, observations, and key
            interactions
          </div>
        </div>

        {/* Session Context */}
        <div className="form-group">
          <label htmlFor="session-context" className="form-label">
            Session Context *
          </label>
          <textarea
            id="session-context"
            value={formData.context}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, context: e.target.value }))
            }
            className={`form-textarea ${errors.context ? 'error' : ''}`}
            placeholder="Describe the session context, goals, and any relevant background..."
            rows={3}
            disabled={isLoading}
          />
          {errors.context && <div className="form-error">{errors.context}</div>}
        </div>

        {/* Demographics */}
        <div className="form-group">
          <h3 className="form-section-title">Patient Demographics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Gender */}
            <div>
              <label htmlFor="gender" className="form-label">
                Gender *
              </label>
              <select
                id="gender"
                value={formData.demographics.gender}
                onChange={(e) =>
                  handleDemographicsChange('gender', e.target.value)
                }
                className={`form-select ${errors.demographics?.gender ? 'error' : ''}`}
                disabled={isLoading}
              >
                <option value="">Select gender</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="non-binary">Non-binary</option>
                <option value="prefer-not-to-say">Prefer not to say</option>
              </select>
              {errors.demographics?.gender && (
                <div className="form-error">{errors.demographics.gender}</div>
              )}
            </div>

            {/* Ethnicity */}
            <div>
              <label htmlFor="ethnicity" className="form-label">
                Ethnicity *
              </label>
              <select
                id="ethnicity"
                value={formData.demographics.ethnicity}
                onChange={(e) =>
                  handleDemographicsChange('ethnicity', e.target.value)
                }
                className={`form-select ${errors.demographics?.ethnicity ? 'error' : ''}`}
                disabled={isLoading}
              >
                <option value="">Select ethnicity</option>
                <option value="white">White/Caucasian</option>
                <option value="black">Black/African American</option>
                <option value="hispanic">Hispanic/Latino</option>
                <option value="asian">Asian</option>
                <option value="native">Native American</option>
                <option value="pacific">Pacific Islander</option>
                <option value="mixed">Mixed Race</option>
                <option value="other">Other</option>
              </select>
              {errors.demographics?.ethnicity && (
                <div className="form-error">
                  {errors.demographics.ethnicity}
                </div>
              )}
            </div>

            {/* Age Group */}
            <div>
              <label htmlFor="age" className="form-label">
                Age Group *
              </label>
              <select
                id="age"
                value={formData.demographics.age}
                onChange={(e) =>
                  handleDemographicsChange('age', e.target.value)
                }
                className={`form-select ${errors.demographics?.age ? 'error' : ''}`}
                disabled={isLoading}
              >
                <option value="">Select age group</option>
                <option value="18-24">18-24 years</option>
                <option value="25-34">25-34 years</option>
                <option value="35-44">35-44 years</option>
                <option value="45-54">45-54 years</option>
                <option value="55-64">55-64 years</option>
                <option value="65+">65+ years</option>
              </select>
              {errors.demographics?.age && (
                <div className="form-error">{errors.demographics.age}</div>
              )}
            </div>

            {/* Primary Language */}
            <div>
              <label htmlFor="language" className="form-label">
                Primary Language *
              </label>
              <select
                id="language"
                value={formData.demographics.primaryLanguage}
                onChange={(e) =>
                  handleDemographicsChange('primaryLanguage', e.target.value)
                }
                className={`form-select ${errors.demographics?.primaryLanguage ? 'error' : ''}`}
                disabled={isLoading}
              >
                <option value="">Select language</option>
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
              {errors.demographics?.primaryLanguage && (
                <div className="form-error">
                  {errors.demographics.primaryLanguage}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Session Type */}
        <div className="form-group">
          <label htmlFor="session-type" className="form-label">
            Session Type
          </label>
          <select
            id="session-type"
            value={formData.sessionType}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, sessionType: e.target.value }))
            }
            className="form-select"
            disabled={isLoading}
          >
            <option value="individual">Individual Therapy</option>
            <option value="group">Group Therapy</option>
            <option value="family">Family Therapy</option>
            <option value="couples">Couples Therapy</option>
            <option value="assessment">Assessment</option>
            <option value="crisis">Crisis Intervention</option>
          </select>
        </div>

        {/* Therapist Notes */}
        <div className="form-group">
          <label htmlFor="therapist-notes" className="form-label">
            Additional Notes (Optional)
          </label>
          <textarea
            id="therapist-notes"
            value={formData.therapistNotes || ''}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                therapistNotes: e.target.value,
              }))
            }
            className="form-textarea"
            placeholder="Any additional context, observations, or notes..."
            rows={3}
            disabled={isLoading}
          />
        </div>

        {/* Submit Error */}
        {errors.submit && (
          <div className="form-error text-center">{errors.submit}</div>
        )}

        {/* Form Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-end">
          <button
            type="button"
            onClick={clearForm}
            className="btn-secondary"
            disabled={isLoading}
          >
            Clear Form
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={isLoading || characterCount === 0}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Analyzing...
              </span>
            ) : (
              'Analyze for Bias'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default BiasDetectionForm
