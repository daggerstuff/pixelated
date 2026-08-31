/**
 * Stub E-Prescribing Adapter
 *
 * In-memory simulation of e-prescribing network for development and testing.
 * Simulates pharmacy search, controlled substance checks, prescription
 * transmission with time-based status progression, and drug interaction alerts.
 */

import type { EPrescribingAdapter } from './adapter'
import type {
  PharmacySearchRequest,
  PharmacySearchResponse,
  PharmacyInfo,
  ControlledSubstanceCheckRequest,
  ControlledSubstanceCheckResult,
  PrescriptionTransmissionRequest,
  PrescriptionTransmissionResponse,
  PrescriptionStatusRequest,
  PrescriptionStatusResponse,
  PrescriptionCancelRequest,
  PrescriptionCancelResponse,
  DrugInteractionCheckRequest,
  DrugInteractionCheckResponse,
  DrugInteractionAlert,
  PrescriptionStatus,
} from './types'

/** Internal transmission record. */
interface TransmissionRecord {
  readonly transmissionId: string
  readonly status: PrescriptionStatus
  readonly transmittedAt: string
  readonly message?: string
  readonly ncpdpId: string
  readonly medicationName: string
}

/** Sequential ID counter. */
let idCounter = 0

function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`
}

/** Simulated pharmacies keyed by ZIP prefix. */
const SIMULATED_PHARMACIES: PharmacyInfo[] = [
  {
    ncpdpId: 'PHARM-001',
    name: 'Central Pharmacy',
    address: ['123 Main St'],
    city: 'Springfield',
    state: 'IL',
    zipCode: '62701',
    phone: '217-555-0100',
    fax: '217-555-0101',
    type: 'retail',
    twentyFourHours: false,
  },
  {
    ncpdpId: 'PHARM-002',
    name: 'MedPlus Pharmacy',
    address: ['456 Oak Ave'],
    city: 'Springfield',
    state: 'IL',
    zipCode: '62701',
    phone: '217-555-0200',
    type: 'retail',
    twentyFourHours: true,
  },
  {
    ncpdpId: 'PHARM-003',
    name: 'Express Scripts Mail Order',
    address: ['PO Box 747'],
    city: 'Tempe',
    state: 'AZ',
    zipCode: '85282',
    phone: '800-555-0300',
    type: 'mail-order',
    twentyFourHours: false,
  },
  {
    ncpdpId: 'PHARM-004',
    name: 'Memorial Hospital Pharmacy',
    address: ['800 W Washington St'],
    city: 'Springfield',
    state: 'IL',
    zipCode: '62702',
    phone: '217-555-0400',
    type: 'hospital',
    twentyFourHours: true,
  },
]

/** Known controlled substance medications (RxNorm codes). */
const KNOWN_CONTROLLED: Record<string, { schedule: string; name: string }> = {
  '1043400': { schedule: 'II', name: 'oxycodone' },
  '1043402': { schedule: 'II', name: 'oxycodone/acetaminophen' },
  '1043560': { schedule: 'II', name: 'morphine' },
  '1043620': { schedule: 'II', name: 'fentanyl' },
  '1043700': { schedule: 'II', name: 'amphetamine' },
  '1043800': { schedule: 'II', name: 'methylphenidate' },
  '1043450': { schedule: 'III', name: 'hydrocodone/acetaminophen' },
  '1043500': { schedule: 'III', name: 'codeine/acetaminophen' },
  '1043600': { schedule: 'IV', name: 'alprazolam' },
  '1043650': { schedule: 'IV', name: 'lorazepam' },
  '1043670': { schedule: 'IV', name: 'diazepam' },
  '1043705': { schedule: 'IV', name: 'zolpidem' },
  '1043750': { schedule: 'V', name: 'pregabalin' },
}

/** Known drug interactions (simplified). Each drug can have multiple interactions. */
const KNOWN_INTERACTIONS: Record<
  string,
  {
    interactsWith: string
    severity: DrugInteractionAlert['severity']
    description: string
  }[]
> = {
  '1043620': [
    {
      interactsWith: '1043400',
      severity: 'major',
      description:
        'Fentanyl and oxycodone: increased risk of respiratory depression when combined.',
    },
    {
      interactsWith: '1043670',
      severity: 'major',
      description:
        'Fentanyl and diazepam: concomitant use increases risk of fatal respiratory depression.',
    },
  ],
  '1043400': [
    {
      interactsWith: '1043670',
      severity: 'major',
      description:
        'Oxycodone and diazepam: concomitant opioid and benzodiazepine use increases risk of fatal respiratory depression.',
    },
  ],
}

/** In-memory transmission store. */
const transmissions = new Map<string, TransmissionRecord>()

function computeStatus(transmittedAt: string, now: Date): PrescriptionStatus {
  const elapsed = now.getTime() - new Date(transmittedAt).getTime()
  if (elapsed < 5 * 60_000) return 'transmitted'
  if (elapsed < 15 * 60_000) return 'received'
  if (elapsed < 30 * 60_000) return 'filled'
  return 'filled'
}

export class StubEPrescribingAdapter implements EPrescribingAdapter {
  async searchPharmacies(
    request: PharmacySearchRequest,
  ): Promise<PharmacySearchResponse> {
    const limit = request.limit ?? 10
    let results = SIMULATED_PHARMACIES.filter((p) =>
      p.zipCode.startsWith(request.zipCode.substring(0, 3)),
    )
    if (request.type) {
      results = results.filter((p) => p.type === request.type)
    }
    return {
      pharmacies: results.slice(0, limit),
      total: results.length,
    }
  }

  async checkControlledSubstance(
    request: ControlledSubstanceCheckRequest,
  ): Promise<ControlledSubstanceCheckResult> {
    const { medication } = request

    // Defense in depth: classification never trusts the caller-supplied
    // schedule. Codes present in the stub's own drug database use the
    // database's schedule regardless of the caller's claim. A code the
    // database cannot classify is treated as potentially controlled until
    // verified, so a forged 'non-controlled' claim can never bypass the
    // DEA/EPCS/PDMP gate.
    const known = KNOWN_CONTROLLED[medication.code]
    const schedule = known?.schedule ?? medication.schedule

    if (!known && medication.schedule === 'non-controlled') {
      return {
        allowed: false,
        reason:
          'Unverified medication: schedule must be confirmed against the drug database before prescribing',
        pdmpChecked: false,
        epcsRequired: true,
      }
    }

    // EPCS required for Schedule II-V
    const epcsRequired = true

    // Check DEA number presence for controlled substances
    if (!medication.deaNumber) {
      return {
        allowed: false,
        reason: 'DEA number required for controlled substance prescribing',
        pdmpChecked: false,
        epcsRequired,
      }
    }

    // Simulate PDMP check
    const priorCount = request.priorPrescriptions?.length ?? 0
    const pdmpFindings =
      priorCount > 5
        ? `Patient has ${priorCount} prior prescriptions on file — review for potential drug-seeking behavior`
        : `Patient has ${priorCount} prior prescriptions on file`

    // Simulate Schedule I restriction (not prescribable)
    if (schedule === 'I') {
      return {
        allowed: false,
        reason: 'Schedule I substances cannot be prescribed',
        pdmpChecked: true,
        pdmpFindings,
        epcsRequired: true,
      }
    }

    return {
      allowed: true,
      pdmpChecked: true,
      pdmpFindings,
      epcsRequired,
    }
  }

  async checkDrugInteractions(
    request: DrugInteractionCheckRequest,
  ): Promise<DrugInteractionCheckResponse> {
    const alerts: DrugInteractionAlert[] = []
    const { medication, activeMedications } = request

    const interactionList = KNOWN_INTERACTIONS[medication.code]
    if (interactionList) {
      for (const active of activeMedications) {
        const activeCode = active.medicationCodeableConcept?.coding?.[0]?.code
        if (!activeCode) continue
        for (const interaction of interactionList) {
          if (activeCode === interaction.interactsWith) {
            alerts.push({
              severity: interaction.severity,
              description: interaction.description,
              interactingDrugs: [
                medication.name,
                active.medicationCodeableConcept?.text ?? 'unknown',
              ],
            })
          }
        }
      }
    }

    return {
      hasInteractions: alerts.length > 0,
      alerts,
    }
  }

  async transmitPrescription(
    request: PrescriptionTransmissionRequest,
  ): Promise<PrescriptionTransmissionResponse> {
    const { medicationRequest, pharmacy, prescriber } = request

    // Validate controlled substance requirements
    const medCode =
      medicationRequest.medicationCodeableConcept?.coding?.[0]?.code ?? ''
    const controlled = KNOWN_CONTROLLED[medCode]
    if (controlled?.schedule === 'I') {
      return {
        transmissionId: nextId('RX'),
        status: 'error',
        transmittedAt: new Date().toISOString(),
        message: 'Schedule I substances cannot be prescribed',
      }
    }
    if (
      controlled &&
      controlled.schedule !== 'non-controlled' &&
      !prescriber.deaNumber
    ) {
      return {
        transmissionId: nextId('RX'),
        status: 'error',
        transmittedAt: new Date().toISOString(),
        message: 'DEA number required for controlled substance prescription',
      }
    }

    const transmissionId = nextId('RX')
    const transmittedAt = new Date().toISOString()
    const medName =
      medicationRequest.medicationCodeableConcept?.text ?? 'Unknown medication'

    transmissions.set(transmissionId, {
      transmissionId,
      status: 'transmitted',
      transmittedAt,
      ncpdpId: pharmacy.ncpdpId,
      medicationName: medName,
    })

    return {
      transmissionId,
      status: 'transmitted',
      transmittedAt,
      message: `Prescription for ${medName} transmitted to ${pharmacy.name}`,
    }
  }

  async checkPrescriptionStatus(
    request: PrescriptionStatusRequest,
  ): Promise<PrescriptionStatusResponse> {
    const record = transmissions.get(request.transmissionId)
    if (!record) {
      return {
        transmissionId: request.transmissionId,
        status: 'error',
        updatedAt: new Date().toISOString(),
        message: 'Transmission not found',
      }
    }

    const now = new Date()
    const status = computeStatus(record.transmittedAt, now)

    // Update record
    transmissions.set(request.transmissionId, { ...record, status })

    return {
      transmissionId: record.transmissionId,
      status,
      updatedAt: now.toISOString(),
      message:
        status === 'filled'
          ? `Prescription filled at ${record.ncpdpId}`
          : undefined,
    }
  }

  async cancelPrescription(
    request: PrescriptionCancelRequest,
  ): Promise<PrescriptionCancelResponse> {
    const record = transmissions.get(request.transmissionId)
    if (!record) {
      return {
        transmissionId: request.transmissionId,
        cancelled: false,
        cancelledAt: new Date().toISOString(),
        message: 'Transmission not found',
      }
    }

    // Recompute from transmittedAt: a stale stored status must not let an
    // already-filled prescription be cancelled.
    if (computeStatus(record.transmittedAt, new Date()) === 'filled') {
      return {
        transmissionId: request.transmissionId,
        cancelled: false,
        cancelledAt: new Date().toISOString(),
        message: 'Cannot cancel a prescription that has already been filled',
      }
    }

    transmissions.set(request.transmissionId, {
      ...record,
      status: 'cancelled',
    })

    return {
      transmissionId: request.transmissionId,
      cancelled: true,
      cancelledAt: new Date().toISOString(),
      message: `Prescription cancelled: ${request.reason}`,
    }
  }
}

/** Singleton stub adapter instance. */
export const stubEPrescribingAdapter = new StubEPrescribingAdapter()
