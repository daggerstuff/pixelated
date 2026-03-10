/**
 * Microsoft SEAL FHE Scheme Implementation
 *
 * Provides a concrete implementation of the FHEScheme interface for Microsoft SEAL
 */

import { FHEOperation } from './types'
import type { FHEScheme } from './types'
import { SEAL_SUPPORTED_OPERATIONS, SealSchemeType } from './seal-types'

/**
 * Implementation of the SEAL FHE scheme
 */
export class SealScheme implements FHEScheme {
  private schemeType: SealSchemeType

  /**
   * Create a new SealScheme instance
   *
   * @param schemeType The SEAL scheme type (BFV, BGV, or CKKS)
   */
  constructor(schemeType: SealSchemeType) {
    this.schemeType = schemeType
  }

  /**
   * Get the name of the scheme
   */
  get name(): string {
    return `Microsoft SEAL (${this.schemeType.toUpperCase()})`
  }

  /**
   * Get the version of the scheme
   */
  get version(): string {
    return '1.0.0' // SEAL version
  }

  /**
   * Check if the scheme supports a specific operation
   *
   * @param operation The operation to check
   * @returns True if the operation is supported by this scheme
   */
  public supportsOperation(operation: FHEOperation): boolean {
    return SEAL_SUPPORTED_OPERATIONS[this.schemeType].includes(operation)
  }

  /**
   * Get all operations supported by this scheme
   *
   * @returns Array of supported operations
   */
  public getOperations(): FHEOperation[] {
    return [...SEAL_SUPPORTED_OPERATIONS[this.schemeType]]
  }

  /**
   * Get the SEAL scheme type
   */
  public getSchemeType(): SealSchemeType {
    return this.schemeType
  }

  /**
   * Get a description of the scheme with its capabilities
   */
  public getDescription(): string {
    const operations = this.getOperations()
      .map((op) => op.charAt(0).toUpperCase() + op.slice(1))
      .join(', ')

    let description = `Microsoft SEAL ${this.schemeType.toUpperCase()} scheme.`

    switch (this.schemeType) {
      case SealSchemeType.BFV:
        description += ' Optimized for integer arithmetic.'
        break
      case SealSchemeType.BGV:
        description += ' Efficient for modular arithmetic.'
        break
      case SealSchemeType.CKKS:
        description +=
          ' Designed for approximate arithmetic on real and complex numbers.'
        break
    }

    description += ` Supported operations: ${operations}.`

    return description
  }

  /**
   * Factory method to create a SealScheme based on the desired operations
   *
   * @param requiredOperations Array of operations that must be supported
   * @returns The most appropriate SealScheme
   * @throws Error if no suitable scheme is found
   */
  public static forOperations(requiredOperations: FHEOperation[]): SealScheme {
    // Check CKKS first if floating-point operations are needed
    if (requiredOperations.includes(FHEOperation.Rescale)) {
      return new SealScheme(SealSchemeType.CKKS)
    }

    // For operations without rescaling, both BFV and BGV could work
    // Prefer BFV as it's generally more efficient for most operations
    const bfvSupported = requiredOperations.every((op) =>
      SEAL_SUPPORTED_OPERATIONS[SealSchemeType.BFV].includes(op),
    )

    if (bfvSupported) {
      return new SealScheme(SealSchemeType.BFV)
    }

    // Try BGV
    const bgvSupported = requiredOperations.every((op) =>
      SEAL_SUPPORTED_OPERATIONS[SealSchemeType.BGV].includes(op),
    )

    if (bgvSupported) {
      return new SealScheme(SealSchemeType.BGV)
    }

    // If we get here, no scheme supports all required operations
    const unsupportedOps = requiredOperations.filter(
      (op) =>
        !SEAL_SUPPORTED_OPERATIONS[SealSchemeType.CKKS].includes(op) &&
        !SEAL_SUPPORTED_OPERATIONS[SealSchemeType.BFV].includes(op) &&
        !SEAL_SUPPORTED_OPERATIONS[SealSchemeType.BGV].includes(op),
    )

    throw new Error(
      `No suitable SEAL scheme found for all required operations. Unsupported operations: ${unsupportedOps.join(', ')}`,
    )
  }
}
