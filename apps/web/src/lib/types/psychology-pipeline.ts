export interface PresentingProblemEvent {
  time: string
  description: string
}

export interface ClinicalCase {
  caseId: string
  patientInfo: PatientInfo
  presentingProblem: string
  presentingProblemDevelopment: PresentingProblemEvent[]
  clinicalFormulation: ClinicalFormulation
  treatmentPlan: TreatmentPlan
}

export interface PatientInfo {
  age: number
  gender: string
  occupation: string
  background: string
}

export interface ClinicalFormulation {
  provisionalDiagnosis: string[]
  contributingFactors: {
    biological: string[]
    psychological: string[]
    social: string[]
  }
  summary: string
}

export interface TreatmentPlan {
  goals: {
    shortTerm: string[]
    longTerm: string[]
  }
  interventions: string[]
  modalities: string[]
  outcomeMeasures: string[]
}
