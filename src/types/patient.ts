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
  patientId: string
  demographics: {
    age: number
    gender: string
    ethnicity?: string
    language?: string
  }
  medicalHistory: string[]
  currentMedications: string[]
  allergies: string[]
  diagnoses: string[]
  riskFactors: string[]
  lastVisit?: Date
  nextAppointment?: Date
}

// Treatment plan
export interface TreatmentPlan {
  id: string
  patientId: string
  diagnosis: string
  goals: string[]
  interventions: string[]
  medications?: string[]
  therapyType?: string
  frequency?: string
  duration?: string
  startDate: Date
  endDate?: Date
  status: 'active' | 'completed' | 'discontinued'
  notes?: string[]
}

// Progress metrics
export interface ProgressMetrics {
  id: string
  patientId: string
  treatmentPlanId: string
  timestamp: Date
  symptoms: Record<string, number>
  functioning: number
  qualityOfLife: number
  adherence: number
  sessionCount: number
  improvements: string[]
  concerns: string[]
}
