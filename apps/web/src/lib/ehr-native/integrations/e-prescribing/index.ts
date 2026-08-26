/**
 * E-Prescribing Integration
 *
 * Barrel export for the e-prescribing module.
 */

export * from './types'
export type { EPrescribingAdapter } from './adapter'
export {
  StubEPrescribingAdapter,
  stubEPrescribingAdapter,
} from './stub-adapter'
export { PrescriptionService } from './prescription-service'
