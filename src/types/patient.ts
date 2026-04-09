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
