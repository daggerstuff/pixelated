/**
 * Microsoft SEAL Context
 *
 * Manages the initialization and configuration of the Microsoft SEAL library
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { SealSchemeType } from './seal-types'
import type {
  SealContextOptions,
  SealEncryptionParamsOptions,
  SealSecurityLevel,
} from './seal-types'

// Initialize logger
const logger = createBuildSafeLogger('seal-context')

/**
 * SealContext manages the SEAL library and context
 */
export class SealContext {
  private seal: unknown
  private context: unknown
  private encryptionParameters: unknown
  private parameters: SealEncryptionParamsOptions
  private scheme: SealSchemeType
  private securityLevel: SealSecurityLevel
  private initialized = false
  private loadPromise: Promise<void> | null = null
  private contextOptions: SealContextOptions // To store the options

  /**
   * Create a new SealContext with the specified options
   */
  constructor(options: SealContextOptions) {
    this.contextOptions = options // Store the full options object
    this.parameters = options.params
    this.scheme = options.scheme
    this.securityLevel = options.params.securityLevel || 'tc128'
  }

  /**
   * Initialize the SEAL library and context
   * This must be called before using any SEAL functionality
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('SEAL context already initialized')
      return
    }

    if (this.loadPromise) {
      logger.info(
        'SEAL context is already being initialized, waiting for completion',
      )
      return this.loadPromise
    }

    this.loadPromise = this.initializeSeal()
    return this.loadPromise
  }

  /**
   * Core initialization logic for SEAL
   */
  private async initializeSeal(): Promise<void> {
    try {
      // Dynamically import SEAL
      logger.info('Loading node-seal library')

      // First try to load from node-seal package
      try {
        const SEAL = await import('node-seal')
        this.seal = await SEAL.default()
        logger.info('Successfully loaded node-seal')
      } catch (err: unknown) {
        // If node-seal is not available, try loading from window if in browser
        logger.debug('Failed to load node-seal package', { error: err })
        if (
          typeof window !== 'undefined' &&
          (window as unknown as { seal?: unknown }).seal
        ) {
          this.seal = (window as unknown as { seal: unknown }).seal
          logger.info('Using window.seal instance')
        } else {
          // No SEAL implementation available
          throw new Error(
            'Failed to load SEAL: node-seal not available and no browser fallback found',
            { cause: err },
          )
        }
      }

      logger.info(
        `Initializing SEAL context with ${this.scheme} scheme, ${this.parameters.polyModulusDegree} poly modulus degree`,
      )

      // Create encryption parameters
      this.encryptionParameters = this.createEncryptionParameters()

      // Create context
      this.context = (
        this.seal as {
          Context: (
            params: unknown,
            expandModChain?: boolean,
            securityLevel?: unknown,
          ) => {
            parametersSet: () => boolean
            usingKeyswitching: () => boolean
            delete: () => void
          }
        }
      ).Context(
        this.encryptionParameters,
        true, // Expand mod chain for better usability
        this.mapSecurityLevel(this.securityLevel),
      )

      if (!(this.context as { parametersSet: () => boolean }).parametersSet()) {
        throw new Error('SEAL parameters are not valid or supported')
      }

      // Log the encryption parameters
      this.logEncryptionParameters()

      this.initialized = true
      logger.info('SEAL context initialized successfully')
    } catch (error: unknown) {
      logger.error('Failed to initialize SEAL context', { error })
      throw new Error(
        `SEAL initialization failed: ${error instanceof Error ? String(error) : String(error)}`,
        { cause: error },
      )
    } finally {
      this.loadPromise = null
    }
  }

  /**
   * Map the security level enum to SEAL security level
   */
  private mapSecurityLevel(level: SealSecurityLevel): unknown {
    if (!this.seal) {
      throw new Error('SEAL is not initialized')
    }

    const sealModule = this.seal as {
      SecurityLevel: {
        tc128: unknown
        tc192: unknown
        tc256: unknown
      }
    }

    switch (level) {
      case 'tc128':
        return sealModule.SecurityLevel.tc128
      case 'tc192':
        return sealModule.SecurityLevel.tc192
      case 'tc256':
        return sealModule.SecurityLevel.tc256
      default:
        return sealModule.SecurityLevel.tc128
    }
  }

  /**
   * Create encryption parameters from the configured options
   */
  private createEncryptionParameters(): unknown {
    if (!this.seal) {
      throw new Error('SEAL is not initialized')
    }

    const sealModule = this.seal as {
      SchemeType: {
        bfv: unknown
        bgv: unknown
        ckks: unknown
      }
      EncryptionParameters: (schemeType: unknown) => {
        setPolyModulusDegree: (degree: number) => void
        setCoeffModulus: (modulus: unknown) => void
        setPlainModulus: (modulus: unknown) => void
      }
      CoeffModulus: {
        Create: (polyModulusDegree: number, bitSizes: number[]) => unknown
        BFVDefault: (polyModulusDegree: number) => unknown
      }
      PlainModulus: {
        Batching: (polyModulusDegree: number, bitSize: number) => unknown
      }
    }

    // Map scheme type
    let schemeType
    switch (this.scheme) {
      case SealSchemeType.CKKS:
        schemeType = sealModule.SchemeType.ckks
        break
      case SealSchemeType.BGV:
        schemeType = sealModule.SchemeType.bgv
        break
      case SealSchemeType.BFV:
      default:
        schemeType = sealModule.SchemeType.bfv
        break
    }

    // Create encryption parameters
    const parms = sealModule.EncryptionParameters(schemeType)

    // Set polynomial modulus degree
    parms.setPolyModulusDegree(this.parameters.polyModulusDegree)

    // Set coefficient modulus based on scheme
    if (this.scheme === SealSchemeType.CKKS) {
      // For CKKS, use specified coefficient modulus bit sizes
      const bitSizes = this.parameters.coeffModulusBits || [60, 40, 40, 60]
      const coeffMod = sealModule.CoeffModulus.Create(
        this.parameters.polyModulusDegree,
        bitSizes,
      )
      parms.setCoeffModulus(coeffMod)
    } else {
      // For BFV/BGV, use default coefficient modulus
      const coeffMod = sealModule.CoeffModulus.BFVDefault(
        this.parameters.polyModulusDegree,
      )
      parms.setCoeffModulus(coeffMod)

      // Set plain modulus for BFV/BGV
      const plainMod = sealModule.PlainModulus.Batching(
        this.parameters.polyModulusDegree,
        this.parameters.plainModulus || 20,
      )
      parms.setPlainModulus(plainMod)
    }

    return parms
  }

  /**
   * Log the encryption parameters for debugging
   */
  /**
   * Get the raw SEAL library instance.
   * Throws an error if SEAL is not initialized.
   */
  public getSealModule(): unknown {
    // Ideally, replace 'any' with a more specific SealModule type if available
    if (!this.seal) {
      throw new Error(
        'SEAL library instance is not available. Ensure initialize() has been called and completed.',
      )
    }
    return this.seal
  }

  /**
   * Get the options used to configure this SEAL context.
   */
  public getOptions(): SealContextOptions {
    return this.contextOptions
  }

  private logEncryptionParameters() {
    logger.info('SEAL encryption parameters:', {
      scheme: this.scheme,
      polyModulusDegree: this.parameters.polyModulusDegree,
      coeffModulusBits: this.parameters.coeffModulusBits || 'default',
      securityLevel: this.securityLevel,
      plainModulus: this.parameters.plainModulus,
      scale: this.parameters.scale,
    })

    logger.debug('SEAL context details:', {
      parametersSet: (
        this.context as { parametersSet: () => boolean }
      ).parametersSet(),
      usingKeyswitching: (
        this.context as { usingKeyswitching: () => boolean }
      ).usingKeyswitching(),
    })
  }

  /**
   * Check if the context is initialized
   */
  public isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Get the initialized SEAL instance
   */
  public getSeal(): unknown {
    this.checkInitialized()
    return this.seal
  }

  /**
   * Get the SEAL context
   */
  public getContext(): unknown {
    this.checkInitialized()
    return this.context
  }

  /**
   * Get the scheme type
   */
  public getSchemeType(): SealSchemeType {
    return this.scheme
  }

  /**
   * Get the encryption parameters
   */
  public getEncryptionParameters(): unknown {
    this.checkInitialized()
    return this.encryptionParameters
  }

  /**
   * Check if the context is initialized
   */
  private checkInitialized() {
    if (!this.initialized) {
      throw new Error('SEAL context not initialized. Call initialize() first.')
    }
  }

  /**
   * Dispose of SEAL resources
   * This should be called when the context is no longer needed
   */
  public dispose() {
    if (this.context) {
      logger.info('Disposing SEAL context')
      ;(this.context as { delete: () => void }).delete()
      this.context = null
    }

    if (this.encryptionParameters) {
      ;(this.encryptionParameters as { delete: () => void }).delete()
      this.encryptionParameters = null
    }

    this.initialized = false
  }
}
