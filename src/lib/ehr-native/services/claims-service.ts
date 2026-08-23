/**
 * EHR Native — Claims Service (F1.10)
 *
 * Stateless domain service for preparing, validating, and tracking
 * FHIR R4 Claim resources prior to clearinghouse submission.
 *
 * The actual clearinghouse integration (submission, status polling,
 * remittance processing) is Phase 2-3 — see `integrations/index.ts`.
 * This service handles the local-side lifecycle: creating claims from
 * encounter data, validating against FHIR R4 and payer requirements,
 * computing totals, and managing claim status transitions.
 */

import type {
  FHIRCodeableConcept,
  FHIRReference,
  FHIRPeriod,
} from '../types/base'
import { claimSchema, type Claim } from '../types/claim'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Claim lifecycle status, extended beyond FHIR's four values to track submission. */
export type ClaimStatus = 'draft' | 'active' | 'cancelled' | 'entered-in-error'

/** Claim use category per FHIR R4. */
export type ClaimUse = 'claim' | 'preauthorization' | 'predetermination'

/** Simplified input for creating a claim line item. */
export interface CreateClaimItemInput {
  /** LOINC or CPT/HCPCS code for the service or product. */
  productOrService: FHIRCodeableConcept
  /** Quantity billed. Defaults to 1. */
  quantity?: number
  /** Unit price including currency. */
  unitPrice?: { value: number; currency?: string }
  /** Billing factor (e.g. 1.0 for full, 0.5 for half). Defaults to 1. */
  factor?: number
  /** Revenue code. */
  revenue?: FHIRCodeableConcept
  /** Category code. */
  category?: FHIRCodeableConcept
  /** Modifier codes. */
  modifier?: FHIRCodeableConcept[]
  /** Date or period the service was rendered. */
  servicedDate?: string
  servicedPeriod?: FHIRPeriod
  /** Encounter reference this item is associated with. */
  encounter?: string
}

/** Simplified input for creating a diagnosis entry on a claim. */
export interface CreateClaimDiagnosisInput {
  /** Reference to a Condition resource. */
  diagnosisReference?: string
  /** Inline codeable concept for the diagnosis. */
  diagnosisCodeableConcept?: FHIRCodeableConcept
  /** Diagnosis type (e.g. principal, admitting). */
  type?: FHIRCodeableConcept[]
  /** On admission indicator. */
  onAdmission?: FHIRCodeableConcept
}

/** Simplified input for creating a procedure entry on a claim. */
export interface CreateClaimProcedureInput {
  /** Reference to a Procedure resource. */
  procedureReference?: string
  /** Inline codeable concept for the procedure. */
  procedureCodeableConcept?: FHIRCodeableConcept
}

/** Simplified input for creating an insurance entry on a claim. */
export interface CreateClaimInsuranceInput {
  /** Whether this is the focal insurance. */
  focal: boolean
  /** Reference to Coverage resource. */
  coverage: string
  /** Pre-authorization references. */
  preAuthRef?: string[]
  /** Business arrangement identifier. */
  businessArrangement?: string
}

/** Input for creating a new claim. */
export interface CreateClaimInput {
  /** Patient reference (FHIR Reference, e.g. "Patient/uuid"). */
  patient: string
  /** Provider reference (FHIR Reference, e.g. "Practitioner/uuid"). */
  provider: string
  /** Claim type (e.g. institutional, professional, pharmacy, oral). */
  type: FHIRCodeableConcept
  /** Claim use: claim, preauthorization, or predetermination. */
  use: ClaimUse
  /** Optional insurer reference. */
  insurer?: string
  /** Optional billable period. */
  billablePeriod?: FHIRPeriod
  /** Optional facility reference. */
  facility?: string
  /** Optional priority codeable concept. */
  priority?: FHIRCodeableConcept
  /** Line items. */
  items: CreateClaimItemInput[]
  /** Diagnoses. */
  diagnoses?: CreateClaimDiagnosisInput[]
  /** Procedures. */
  procedures?: CreateClaimProcedureInput[]
  /** Insurance coverages. */
  insurance?: CreateClaimInsuranceInput[]
}

/** Result of claim validation. */
export interface ClaimValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/** Claim summary statistics for a batch of claims. */
export interface ClaimSummary {
  total: number
  byStatus: Record<string, number>
  byUse: Record<string, number>
  totalBilled: number
  currency: string
}

/** Claim lifecycle transition. */
export interface ClaimStatusTransition {
  from: ClaimStatus
  to: ClaimStatus
  allowed: boolean
  reason?: string
}

// ---------------------------------------------------------------------------
// Internal helpers for building FHIR claim objects
// ---------------------------------------------------------------------------

interface ClaimItemObj {
  sequence: number
  productOrService: FHIRCodeableConcept
  quantity?: { value: number }
  unitPrice?: { value: number; currency?: string }
  factor?: number
  revenue?: FHIRCodeableConcept
  category?: FHIRCodeableConcept
  modifier?: FHIRCodeableConcept[]
  servicedDate?: string
  servicedPeriod?: FHIRPeriod
  encounter?: FHIRReference[]
}

interface ClaimDiagnosisObj {
  sequence: number
  diagnosisReference?: FHIRReference
  diagnosisCodeableConcept?: FHIRCodeableConcept
  type?: FHIRCodeableConcept[]
  onAdmission?: FHIRCodeableConcept
}

interface ClaimProcedureObj {
  sequence: number
  procedureReference?: FHIRReference
  procedureCodeableConcept?: FHIRCodeableConcept
}

interface ClaimInsuranceObj {
  sequence: number
  focal: boolean
  coverage: FHIRReference
  preAuthRef?: string[]
  businessArrangement?: string
}

interface ClaimObj {
  resourceType: string
  status: string
  type: FHIRCodeableConcept
  use: string
  patient: FHIRReference
  provider: FHIRReference
  item: ClaimItemObj[]
  insurer?: FHIRReference
  billablePeriod?: FHIRPeriod
  facility?: FHIRReference
  priority?: FHIRCodeableConcept
  diagnosis?: ClaimDiagnosisObj[]
  procedure?: ClaimProcedureObj[]
  insurance?: ClaimInsuranceObj[]
  total?: { value: number; currency: string }
}

function buildClaimItem(
  item: CreateClaimItemInput,
  index: number,
): ClaimItemObj {
  const lineItem: ClaimItemObj = {
    sequence: index + 1,
    productOrService: item.productOrService,
  }
  if (item.quantity !== undefined) {
    lineItem.quantity = { value: item.quantity }
  }
  if (item.unitPrice) {
    lineItem.unitPrice = item.unitPrice
  }
  if (item.factor !== undefined) {
    lineItem.factor = item.factor
  }
  if (item.revenue) {
    lineItem.revenue = item.revenue
  }
  if (item.category) {
    lineItem.category = item.category
  }
  if (item.modifier) {
    lineItem.modifier = item.modifier
  }
  if (item.servicedDate) {
    lineItem.servicedDate = item.servicedDate
  }
  if (item.servicedPeriod) {
    lineItem.servicedPeriod = item.servicedPeriod
  }
  if (item.encounter) {
    lineItem.encounter = [{ reference: item.encounter } as FHIRReference]
  }
  return lineItem
}

function buildDiagnosis(
  diag: CreateClaimDiagnosisInput,
  index: number,
): ClaimDiagnosisObj {
  const entry: ClaimDiagnosisObj = { sequence: index + 1 }
  if (diag.diagnosisReference) {
    entry.diagnosisReference = {
      reference: diag.diagnosisReference,
    } as FHIRReference
  }
  if (diag.diagnosisCodeableConcept) {
    entry.diagnosisCodeableConcept = diag.diagnosisCodeableConcept
  }
  if (diag.type) {
    entry.type = diag.type
  }
  if (diag.onAdmission) {
    entry.onAdmission = diag.onAdmission
  }
  return entry
}

function buildProcedure(
  proc: CreateClaimProcedureInput,
  index: number,
): ClaimProcedureObj {
  const entry: ClaimProcedureObj = { sequence: index + 1 }
  if (proc.procedureReference) {
    entry.procedureReference = {
      reference: proc.procedureReference,
    } as FHIRReference
  }
  if (proc.procedureCodeableConcept) {
    entry.procedureCodeableConcept = proc.procedureCodeableConcept
  }
  return entry
}

// ---------------------------------------------------------------------------
// Valid status transitions
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  'draft': ['active', 'cancelled', 'entered-in-error'],
  'active': ['cancelled', 'entered-in-error'],
  'cancelled': ['entered-in-error'],
  'entered-in-error': [],
}

// ---------------------------------------------------------------------------
// ClaimsService
// ---------------------------------------------------------------------------

export class ClaimsService {
  /**
   * Creates a FHIR R4 Claim resource from simplified input.
   *
   * @param input - The claim creation input
   * @returns A validated FHIR R4 Claim resource
   * @throws {Error} If the generated claim fails FHIR validation
   */
  createClaim(input: CreateClaimInput): Claim {
    if (!input.items || input.items.length === 0) {
      throw new Error('Claim must have at least one line item')
    }

    const items = input.items.map((item, index) => buildClaimItem(item, index))

    const claim: ClaimObj = {
      resourceType: 'Claim',
      status: 'draft',
      type: input.type,
      use: input.use,
      patient: { reference: input.patient } as FHIRReference,
      provider: { reference: input.provider } as FHIRReference,
      item: items,
    }

    if (input.insurer) {
      claim.insurer = { reference: input.insurer } as FHIRReference
    }
    if (input.billablePeriod) {
      claim.billablePeriod = input.billablePeriod
    }
    if (input.facility) {
      claim.facility = { reference: input.facility } as FHIRReference
    }
    if (input.priority) {
      claim.priority = input.priority
    }

    if (input.diagnoses && input.diagnoses.length > 0) {
      claim.diagnosis = input.diagnoses.map((d, index) =>
        buildDiagnosis(d, index),
      )
    }

    if (input.procedures && input.procedures.length > 0) {
      claim.procedure = input.procedures.map((p, index) =>
        buildProcedure(p, index),
      )
    }

    if (input.insurance && input.insurance.length > 0) {
      claim.insurance = input.insurance.map((ins, index) => ({
        sequence: index + 1,
        focal: ins.focal,
        coverage: { reference: ins.coverage } as FHIRReference,
        ...(ins.preAuthRef ? { preAuthRef: ins.preAuthRef } : {}),
        ...(ins.businessArrangement
          ? { businessArrangement: ins.businessArrangement }
          : {}),
      }))
    }

    const total = this.calculateTotal(claim as unknown as Claim)
    if (total.value > 0) {
      claim.total = total
    }

    return claimSchema.parse(claim) as Claim
  }

  /**
   * Validates a FHIR R4 Claim against schema and business rules.
   *
   * @param claim - The claim to validate
   * @returns Validation result with errors and warnings
   */
  validateClaim(claim: unknown): ClaimValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    const parseResult = claimSchema.safeParse(claim)
    if (!parseResult.success) {
      for (const issue of parseResult.error.issues) {
        errors.push(`${issue.path.join('.')}: ${issue.message}`)
      }
      return { valid: false, errors, warnings }
    }

    const validClaim = parseResult.data

    if (!validClaim.item || validClaim.item.length === 0) {
      errors.push('Claim must have at least one line item')
    }

    if (
      validClaim.use === 'claim' &&
      (!validClaim.insurance || validClaim.insurance.length === 0)
    ) {
      errors.push(
        'A claim with use=claim must have at least one insurance entry',
      )
    }

    if (validClaim.insurance) {
      const focalCount = validClaim.insurance.filter((i) => i.focal).length
      if (focalCount === 0) {
        warnings.push(
          'No focal insurance identified; defaulting to first insurance as focal',
        )
      } else if (focalCount > 1) {
        errors.push('Only one insurance entry can be marked as focal')
      }
    }

    if (validClaim.diagnosis) {
      const sequences = validClaim.diagnosis.map((d) => d.sequence)
      const unique = new Set(sequences)
      if (sequences.length !== unique.size) {
        warnings.push('Diagnosis sequence numbers contain duplicates')
      }
    }

    if (validClaim.procedure) {
      const sequences = validClaim.procedure.map((p) => p.sequence)
      const unique = new Set(sequences)
      if (sequences.length !== unique.size) {
        warnings.push('Procedure sequence numbers contain duplicates')
      }
    }

    for (const [index, item] of (validClaim.item ?? []).entries()) {
      if (!item.productOrService) {
        errors.push(`Item ${index + 1}: productOrService is required`)
      }
      if (
        item.quantity &&
        item.quantity.value !== undefined &&
        item.quantity.value <= 0
      ) {
        warnings.push(`Item ${index + 1}: quantity should be positive`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Calculates the total billed amount from all line items.
   *
   * @param claim - The claim resource
   * @returns Total with currency
   */
  calculateTotal(claim: Claim): { value: number; currency: string } {
    let total = 0
    let currency = 'USD'

    const currencies = new Set<string>()
    for (const item of claim.item ?? []) {
      const qty = item.quantity?.value ?? 1
      const unitPrice = item.unitPrice?.value ?? 0
      const factor = item.factor ?? 1
      if (item.unitPrice?.currency) {
        currency = item.unitPrice.currency
        currencies.add(item.unitPrice.currency)
      }
      total += qty * unitPrice * factor
    }

    if (currencies.size > 1) {
      throw new Error(
        `Cannot calculate total: claim contains items with mixed currencies (${[...currencies].join(', ')})`,
      )
    }

    return { value: Math.round(total * 100) / 100, currency }
  }

  /**
   * Validates whether a status transition is allowed.
   *
   * @param from - Current status
   * @param to - Target status
   * @returns Transition result with allowed flag and optional reason
   */
  validateStatusTransition(
    from: ClaimStatus,
    to: ClaimStatus,
  ): ClaimStatusTransition {
    if (from === to) {
      return { from, to, allowed: true, reason: 'No change' }
    }

    const allowed = VALID_TRANSITIONS[from] ?? []
    if (allowed.includes(to)) {
      return { from, to, allowed: true }
    }

    return {
      from,
      to,
      allowed: false,
      reason: `Cannot transition from ${from} to ${to}`,
    }
  }

  /**
   * Updates the status of a claim, validating the transition.
   *
   * @param claim - The claim to update
   * @param newStatus - The target status
   * @returns The updated claim, or throws if the transition is invalid
   * @throws {Error} If the status transition is not allowed
   */
  updateStatus(claim: Claim, newStatus: ClaimStatus): Claim {
    const currentStatus = claim.status as ClaimStatus
    const transition = this.validateStatusTransition(currentStatus, newStatus)

    if (!transition.allowed) {
      throw new Error(
        `Invalid claim status transition: ${transition.reason ?? 'not permitted'}`,
      )
    }

    return { ...claim, status: newStatus }
  }

  /**
   * Adds a diagnosis to a claim.
   *
   * @param claim - The claim to modify
   * @param diagnosis - The diagnosis input
   * @returns A new claim with the diagnosis added
   */
  addDiagnosis(claim: Claim, diagnosis: CreateClaimDiagnosisInput): Claim {
    const existing = claim.diagnosis ?? []
    const nextSequence = existing.length + 1

    const entry: ClaimDiagnosisObj = buildDiagnosis(diagnosis, nextSequence - 1)

    return { ...claim, diagnosis: [...existing, entry] }
  }

  /**
   * Adds a procedure to a claim.
   *
   * @param claim - The claim to modify
   * @param procedure - The procedure input
   * @returns A new claim with the procedure added
   */
  addProcedure(claim: Claim, procedure: CreateClaimProcedureInput): Claim {
    const existing = claim.procedure ?? []
    const nextSequence = existing.length + 1

    const entry: ClaimProcedureObj = buildProcedure(procedure, nextSequence - 1)

    return { ...claim, procedure: [...existing, entry] }
  }

  /**
   * Adds a line item to a claim.
   *
   * @param claim - The claim to modify
   * @param item - The item input
   * @returns A new claim with the item added, with recalculated total
   */
  addItem(claim: Claim, item: CreateClaimItemInput): Claim {
    const existing = claim.item ?? []
    const nextSequence = existing.length + 1

    const lineItem = buildClaimItem(item, nextSequence - 1)

    const updated: Claim = { ...claim, item: [...existing, lineItem] }
    const total = this.calculateTotal(updated)
    if (total.value > 0) {
      updated.total = total
    }

    return updated
  }

  /**
   * Generates summary statistics for a batch of claims.
   *
   * @param claims - Array of claims to summarize
   * @returns Summary with counts by status, use, and total billed
   */
  getSummary(claims: Claim[]): ClaimSummary {
    const byStatus: Record<string, number> = {}
    const byUse: Record<string, number> = {}
    let totalBilled = 0
    let currency = 'USD'
    let currencySet = false

    for (const claim of claims) {
      byStatus[claim.status] = (byStatus[claim.status] ?? 0) + 1
      byUse[claim.use] = (byUse[claim.use] ?? 0) + 1

      if (claim.total?.currency && !currencySet) {
        currency = claim.total.currency
        currencySet = true
      }
      if (claim.total?.value) {
        totalBilled += claim.total.value
      }
    }

    return {
      total: claims.length,
      byStatus,
      byUse,
      totalBilled: Math.round(totalBilled * 100) / 100,
      currency,
    }
  }

  /**
   * Prepares a claim for clearinghouse submission by validating it
   * and marking it as active.
   *
   * Actual submission to a clearinghouse is handled by the
   * integrations module (Phase 2-3).
   *
   * @param claim - The draft claim to prepare
   * @returns The validated, active claim ready for submission
   * @throws {Error} If the claim fails validation or is not in draft status
   */
  prepareForSubmission(claim: Claim): Claim {
    if (claim.status !== 'draft') {
      throw new Error(
        `Cannot prepare claim for submission: expected status draft, got ${claim.status}`,
      )
    }

    const validation = this.validateClaim(claim)
    if (!validation.valid) {
      throw new Error(
        `Claim validation failed: ${validation.errors.join('; ')}`,
      )
    }

    return this.updateStatus(claim, 'active')
  }
}

export const claimsService = new ClaimsService()
