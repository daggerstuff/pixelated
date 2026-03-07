import { z } from 'zod'

// Provider Types
export interface EHRProvider {
  initialize: () => unknown
  cleanup: () => unknown
  id: string
  name: string
  vendor: EHRVendor
  baseUrl: string
  clientId: string
  clientSecret: string
  scopes: string[]
}

export type EHRVendor = 'epic' | 'cerner' | 'allscripts' | 'athenahealth'

// FHIR Resource Types
export interface FHIRResource {
  resourceType: string
  id: string
  meta?: {
    versionId?: string
    lastUpdated?: string
    source?: string
  }
}

export interface Patient extends FHIRResource {
  resourceType: 'Patient'
  active?: boolean
  name?: Array<{
    use?: string
    text?: string
    family?: string
    given?: string[]
  }>
  gender?: string
  birthDate?: string
  address?: Array<{
    use?: string
    type?: string
    text?: string
    line?: string[]
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }>
}

export interface Practitioner extends FHIRResource {
  resourceType: 'Practitioner'
  active?: boolean
  name?: Array<{
    use?: string
    text?: string
    family?: string
    given?: string[]
  }>
  telecom?: Array<{
    system?: string
    value?: string
    use?: string
  }>
  qualification?: Array<{
    identifier?: Array<{
      system?: string
      value?: string
    }>
    code?: {
      coding?: Array<{
        system?: string
        code?: string
        display?: string
      }>
    }
  }>
}

// Service Interfaces
export interface EHRService {
  configureProvider: (config: EHRProvider) => Promise<void>
  connect: (providerId: string) => Promise<void>
  disconnect: (providerId: string) => Promise<void>
  getFHIRClient: (providerId: string) => FHIRClient
}

export interface FHIRClient {
  searchResources: <T extends FHIRResource>(
    resourceType: string,
    params: Record<string, string>,
  ) => Promise<T[]>
  getResource: <T extends FHIRResource>(
    resourceType: string,
    id: string,
  ) => Promise<T>
  createResource: <T extends FHIRResource>(
    resource: Omit<T, 'id'>,
  ) => Promise<T>
  updateResource: <T extends FHIRResource>(resource: T) => Promise<T>
  deleteResource: (resourceType: string, id: string) => Promise<void>
}

// Plugin System Types
export interface PluginAPI {
  events: EventEmitter
  storage: StorageAPI
  fhir: FHIRClient
  logger: Logger
}

export interface EventEmitter {
  on: <T = unknown>(event: string, handler: (data: T) => void) => void
  off: <T = unknown>(event: string, handler: (data: T) => void) => void
  emit: <T = unknown>(event: string, data: T) => void
}

export interface StorageAPI {
  get: <T = unknown>(key: string) => Promise<T>
  set: <T = unknown>(key: string, value: T) => Promise<void>
  delete: (key: string) => Promise<void>
}

export interface Logger {
  info: (message: string, meta?: Record<string, unknown>) => void
  error: (
    message: string,
    error?: Error,
    meta?: Record<string, unknown>,
  ) => void
  warn: (message: string, meta?: Record<string, unknown>) => void
  debug: (message: string, meta?: Record<string, unknown>) => void
}

// Validation Schemas
export const ehrProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  vendor: z.enum(['epic', 'cerner', 'allscripts', 'athenahealth']),
  baseUrl: z.string().url(),
  clientId: z.string(),
  clientSecret: z.string(),
  scopes: z.array(z.string()),
})

export const patientSchema = z.object({
  resourceType: z.literal('Patient'),
  id: z.string(),
  active: z.boolean().optional(),
  name: z
    .array(
      z.object({
        use: z.string().optional(),
        text: z.string().optional(),
        family: z.string().optional(),
        given: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  gender: z.string().optional(),
  birthDate: z.string().optional(),
  address: z
    .array(
      z.object({
        use: z.string().optional(),
        type: z.string().optional(),
        text: z.string().optional(),
        line: z.array(z.string()).optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().optional(),
      }),
    )
    .optional(),
})

// Error Types
export class EHRError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider?: string,
    public originalError?: Error,
  ) {
    super(message)
    this.name = 'EHRError'
  }
}

export class FHIRError extends EHRError {
  constructor(
    message: string,
    code: string,
    provider?: string,
    public resourceType?: string,
    public resourceId?: string,
    originalError?: Error,
  ) {
    super(message, code, provider, originalError)
    this.name = 'FHIRError'
  }
}
