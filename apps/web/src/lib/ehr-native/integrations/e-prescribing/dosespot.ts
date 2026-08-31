/**
 * DoseSpot E-Prescribing Adapter
 *
 * Concrete implementation of the EPrescribingAdapter for the DoseSpot
 * e-prescribing network. Provides pharmacy lookup, controlled substance
 * verification (PDMP + EPCS), drug interaction checking, prescription
 * transmission, status tracking, and cancellation via the DoseSpot API.
 *
 * @see https://dosespot.com/api
 */

import { secureEphiUrl, secureSend } from '../transport'
import type { EPrescribingAdapter } from './adapter'
import type {
  PharmacySearchRequest,
  PharmacySearchResponse,
  PharmacyInfo,
  ControlledSubstanceCheckRequest,
  ControlledSubstanceCheckResult,
  DrugInteractionCheckRequest,
  DrugInteractionCheckResponse,
  DrugInteractionAlert,
  PrescriptionTransmissionRequest,
  PrescriptionTransmissionResponse,
  PrescriptionStatusRequest,
  PrescriptionStatusResponse,
  PrescriptionCancelRequest,
  PrescriptionCancelResponse,
  PrescriptionStatus,
} from './types'

/** Configuration for the DoseSpot adapter. */
export interface DoseSpotConfig {
  /** DoseSpot API key. */
  readonly apiKey: string
  /** DoseSpot clinic key. */
  readonly clinicKey: string
  /** Base URL for the DoseSpot API. */
  readonly baseUrl: string
  /** Request timeout in milliseconds (default 30000). */
  readonly timeoutMs?: number
}

interface DoseSpotPharmacy {
  NcpdpId: string
  PharmacyName: string
  Address1: string
  Address2?: string
  City: string
  State: string
  ZipCode: string
  PrimaryPhone: string
  FaxPhone?: string
  PharmacyType: string
  Is24Hour?: boolean
}

interface DoseSpotInteraction {
  Severity: string
  Description: string
  InteractingDrugs: string[]
}

interface DoseSpotTransmission {
  TransmissionId: string
  Status: string
  TransmittedAt: string
  Message?: string
}

interface DoseSpotStatusResponse {
  TransmissionId: string
  Status: string
  UpdatedAt: string
  Message?: string
}

interface DoseSpotCancelResponse {
  TransmissionId: string
  Cancelled: boolean
  CancelledAt: string
  Message?: string
}

const DEFAULT_TIMEOUT_MS = 30000

function parsePharmacyType(type: string): 'retail' | 'mail-order' | 'hospital' {
  const lower = type.toLowerCase()
  if (lower.includes('mail')) return 'mail-order'
  if (lower.includes('hospital') || lower.includes('clinic')) return 'hospital'
  return 'retail'
}

function parsePrescriptionStatus(status: string): PrescriptionStatus {
  const lower = status.toLowerCase()
  switch (lower) {
    case 'pending':
      return 'pending'
    case 'transmitted':
    case 'sent':
      return 'transmitted'
    case 'received':
    case 'accepted':
      return 'received'
    case 'filled':
    case 'completed':
      return 'filled'
    case 'cancelled':
    case 'canceled':
      return 'cancelled'
    default:
      return 'error'
  }
}

function mapPharmacy(raw: DoseSpotPharmacy): PharmacyInfo {
  const address = [raw.Address1, raw.Address2].filter(Boolean) as string[]
  return {
    ncpdpId: raw.NcpdpId,
    name: raw.PharmacyName,
    address,
    city: raw.City,
    state: raw.State,
    zipCode: raw.ZipCode,
    phone: raw.PrimaryPhone,
    fax: raw.FaxPhone,
    type: parsePharmacyType(raw.PharmacyType),
    twentyFourHours: raw.Is24Hour,
  }
}

function mapInteraction(raw: DoseSpotInteraction): DrugInteractionAlert {
  const lower = raw.Severity.toLowerCase()
  let severity: 'critical' | 'major' | 'moderate' | 'minor'
  if (lower === 'critical' || lower === 'contraindicated') {
    severity = 'critical'
  } else if (lower === 'major') {
    severity = 'major'
  } else if (lower === 'moderate') {
    severity = 'moderate'
  } else {
    severity = 'minor'
  }
  return {
    severity,
    description: raw.Description,
    interactingDrugs: raw.InteractingDrugs,
  }
}

function extractPatientId(
  medicationRequest: PrescriptionTransmissionRequest['medicationRequest'],
): string {
  const reference = medicationRequest.subject?.reference
  const match = reference?.match(/^Patient\/([^/]+)$/)

  if (!match) {
    throw new Error(
      `Invalid MedicationRequest.subject.reference: ${reference ?? 'missing'}`,
    )
  }

  return match[1]
}

export class DoseSpotAdapter implements EPrescribingAdapter {
  private readonly timeoutMs: number

  constructor(private readonly config: DoseSpotConfig) {
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  private get headers(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'X-Clinic-Key': this.config.clinicKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  }

  private get baseUrl(): string {
    return this.config.baseUrl.replace(/\/+$/, '')
  }

  private async makeRequest<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    // HeadersInit may be an array of pairs or a Headers instance, so merge
    // via Headers rather than object spread to avoid index-key corruption.
    const headers = new Headers(this.headers)
    if (options.headers) {
      new Headers(options.headers).forEach((value, key) => {
        headers.set(key, value)
      })
    }

    try {
      const response = await secureSend(
        secureEphiUrl(`${this.baseUrl}${path}`, 'DoseSpot'),
        {
          ...options,
          headers,
          signal: controller.signal,
        },
      )

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(
          `DoseSpot API error ${response.status}: ${body || response.statusText}`,
        )
      }

      return (await response.json()) as T
    } finally {
      clearTimeout(timeoutId)
    }
  }

  async searchPharmacies(
    request: PharmacySearchRequest,
  ): Promise<PharmacySearchResponse> {
    const params = new URLSearchParams({
      zip: request.zipCode,
    })
    if (request.limit !== undefined) {
      params.set('limit', String(request.limit))
    }
    if (request.type !== undefined) {
      params.set('type', request.type)
    }

    const data = await this.makeRequest<{
      pharmacies: DoseSpotPharmacy[]
      total: number
    }>(`/api/pharmacies?${params.toString()}`)

    return {
      pharmacies: data.pharmacies.map(mapPharmacy),
      total: data.total,
    }
  }

  async checkControlledSubstance(
    request: ControlledSubstanceCheckRequest,
  ): Promise<ControlledSubstanceCheckResult> {
    // Defense in depth: a caller-asserted 'non-controlled' classification
    // is never forwarded to the remote check. The adapter has no local
    // drug database to confirm it, and letting the claim reach DoseSpot
    // would let unlisted controlled substances bypass PDMP/EPCS
    // verification. Unverified medications are treated as potentially
    // controlled until verified.
    if (request.medication.schedule === 'non-controlled') {
      return {
        allowed: false,
        reason:
          'Unverified medication: schedule must be confirmed against the drug database before prescribing',
        pdmpChecked: false,
        epcsRequired: true,
      }
    }

    const body = {
      medication: {
        code: request.medication.code,
        name: request.medication.name,
        schedule: request.medication.schedule,
      },
      patientId: request.patientId,
      prescriberNPI: request.prescriberNPI,
      priorPrescriptions: request.priorPrescriptions?.map((rx) => ({
        id: rx.identifier?.[0]?.value ?? '',
        medicationCode: rx.medicationCodeableConcept?.coding?.[0]?.code ?? '',
      })),
    }

    const data = await this.makeRequest<{
      allowed: boolean
      reason?: string
      pdmpChecked: boolean
      pdmpFindings?: string
      epcsRequired: boolean
    }>('/api/controlled-substance-check', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    return {
      allowed: data.allowed,
      reason: data.reason,
      pdmpChecked: data.pdmpChecked,
      pdmpFindings: data.pdmpFindings,
      epcsRequired: data.epcsRequired,
    }
  }

  async checkDrugInteractions(
    request: DrugInteractionCheckRequest,
  ): Promise<DrugInteractionCheckResponse> {
    const body = {
      medication: {
        code: request.medication.code,
        name: request.medication.name,
      },
      patientId: request.patientId,
      activeMedications: request.activeMedications.map((rx) => ({
        id: rx.identifier?.[0]?.value ?? '',
        medicationCode: rx.medicationCodeableConcept?.coding?.[0]?.code ?? '',
      })),
    }

    const data = await this.makeRequest<{
      hasInteractions: boolean
      interactions: DoseSpotInteraction[]
    }>('/api/drug-interactions', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    return {
      hasInteractions: data.hasInteractions,
      alerts: data.interactions.map(mapInteraction),
    }
  }

  async transmitPrescription(
    request: PrescriptionTransmissionRequest,
  ): Promise<PrescriptionTransmissionResponse> {
    const patientId = extractPatientId(request.medicationRequest)

    const body = {
      patientId,
      medicationRequest: {
        id: request.medicationRequest.identifier?.[0]?.value ?? '',
        status: request.medicationRequest.status,
        intent: request.medicationRequest.intent,
        medicationCode:
          request.medicationRequest.medicationCodeableConcept?.coding?.[0]
            ?.code ?? '',
        medicationName:
          request.medicationRequest.medicationCodeableConcept?.text ?? '',
        authoredOn: request.medicationRequest.authoredOn ?? '',
      },
      pharmacy: {
        ncpdpId: request.pharmacy.ncpdpId,
        name: request.pharmacy.name,
      },
      prescriber: {
        npi: request.prescriber.npi,
        name: request.prescriber.name,
        deaNumber: request.prescriber.deaNumber,
      },
    }

    const data = await this.makeRequest<DoseSpotTransmission>(
      '/api/prescriptions/transmit',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    )

    return {
      transmissionId: data.TransmissionId,
      status: parsePrescriptionStatus(data.Status),
      transmittedAt: data.TransmittedAt,
      message: data.Message,
    }
  }

  async checkPrescriptionStatus(
    request: PrescriptionStatusRequest,
  ): Promise<PrescriptionStatusResponse> {
    const data = await this.makeRequest<DoseSpotStatusResponse>(
      `/api/prescriptions/${encodeURIComponent(request.transmissionId)}/status`,
    )

    return {
      transmissionId: data.TransmissionId,
      status: parsePrescriptionStatus(data.Status),
      updatedAt: data.UpdatedAt,
      message: data.Message,
    }
  }

  async cancelPrescription(
    request: PrescriptionCancelRequest,
  ): Promise<PrescriptionCancelResponse> {
    const data = await this.makeRequest<DoseSpotCancelResponse>(
      `/api/prescriptions/${encodeURIComponent(request.transmissionId)}/cancel`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: request.reason }),
      },
    )

    return {
      transmissionId: data.TransmissionId,
      cancelled: data.Cancelled,
      cancelledAt: data.CancelledAt,
      message: data.Message,
    }
  }
}
