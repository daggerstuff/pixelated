// Patient types
export interface Patient {
  id: string
  name: string
  dateOfBirth?: string
  gender?: string
  email?: string
  phone?: string
  address?: Address
  medicalRecordNumber?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface Address {
  street: string
  city: string
  state: string
  zipCode: string
  country: string
}

export interface PatientContact {
  id: string
  patientId: string
  contactType: 'emergency' | 'doctor' | 'insurance'
  name: string
  phone: string
  email?: string
  relationship?: string
}

// Patient profile for clinical use
export interface PatientProfile {
  id: string
  name: string
  age: number
  gender?: string
  contact?: {
    email?: string
    phone?: string
    address?: string
  }
  emergencyContact?: {
    name: string
    phone: string
    relationship: string
  }
  therapistId?: string
  diagnosis: string[]
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  treatmentStatus: 'active' | 'inactive' | 'completed' | 'discharged'
  progress: number
  sessionHistory?: Array<{
    date: Date
    type: string
    duration: number
    emotionAnalysis?: {
      moodScore: number
      dominantEmotion: string
    }
  }>
  notes?: string
  milestones?: string[]
  achievements?: string[]
  barriers?: string[]
  observations?: string[]
  followUpSchedule?: string[]
  supportResources?: string[]
  warningSigns?: string[]
  customFields?: Record<string, any>
  treatmentPlan?: TreatmentPlan
  encryptedFields: string[]
  createdAt: Date
  updatedAt: Date
  lastSeen?: Date
}

// Treatment plan
export interface TreatmentPlan {
  goals: string[]
  interventions?: string[]
  startDate?: Date
  endDate?: Date
  status?: 'active' | 'completed' | 'discontinued'
}

// Progress metrics
export interface ProgressMetrics {
  overallProgress: number
  sessionAttendance: number
  homeworkCompletion: number
  goalAchievement: number
  symptomImprovement: number
  functionalImprovement: number
  qualityOfLife: number
}
