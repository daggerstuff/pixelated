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

interface SealContextLike {
  parametersSet(): boolean
  usingKeyswitching(): boolean
  delete(): void
}

interface SealEncryptionParametersLike {
  setPolyModulusDegree(degree: number): void
  setCoeffModulus(modulus: unknown): void
  setPlainModulus(modulus: unknown): void
  delete(): void
}

interface SealModuleLike {
  Context(
    params: unknown,
    expandModChain?: boolean,
    securityLevel?: unknown,
  ): SealContextLike
  SecurityLevel: {
    tc128: unknown
    tc192: unknown
    tc256: unknown
  }
  SchemeType: {
    bfv: unknown
    bgv: unknown
    ckks: unknown
  }
  EncryptionParameters: (schemeType: unknown) => SealEncryptionParametersLike
  CoeffModulus: {
    Create(polyModulusDegree: number, bitSizes: number[]): unknown
    BFVDefault(polyModulusDegree: number): unknown
  }
  PlainModulus: {
    Batching(polyModulusDegree: number, bitSize: number): unknown
  }
}

// Initialize logger
const logger = createBuildSafeLogger('seal-context')

const getObjectProperty = (value: object, property: string | symbol): unknown =>
  Reflect.get(value, property)

/**
 * SealContext manages the SEAL library and context
 */
export class SealContext {
  private seal: unknown
  private context: SealContextLike | null = null
  private encryptionParameters: SealEncryptionParametersLike | null = null
  private readonly parameters: SealEncryptionParamsOptions
  private readonly scheme: SealSchemeType
  private readonly securityLevel: SealSecurityLevel
  private initialized = false
  private loadPromise: Promise<void> | null = null
  private readonly contextOptions: SealContextOptions // To store the options

  /**
   * Create a new SealContext with the specified options
   */
  constructor(options: SealContextOptions) {
    this.contextOptions = options // Store the full options object
    this.parameters = options.params
    this.scheme = options.scheme
    this.securityLevel = options.params.securityLevel ?? 'tc128'
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
        const browserSeal =
          typeof window !== 'undefined'
            ? (window as Window & { seal?: unknown }).seal
            : undefined
        if (browserSeal) {
          this.seal = browserSeal
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
      const sealModule = this.getValidatedSealModule()
      this.context = sealModule.Context(
        this.encryptionParameters,
        true, // Expand mod chain for better usability
        this.mapSecurityLevel(this.securityLevel),
      )
      if (!this.isSealContext(this.context)) {
        throw new Error('SEAL module returned an invalid context')
      }

      if (!this.context.parametersSet()) {
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

  private isSealContext(value: unknown): value is SealContextLike {
    if (typeof value !== 'object' || value === null) {
      return false
    }

    return (
      typeof getObjectProperty(value, 'parametersSet') === 'function' &&
      typeof getObjectProperty(value, 'usingKeyswitching') === 'function' &&
      typeof getObjectProperty(value, 'delete') === 'function'
    )
  }

  private getValidatedSealModule(): SealModuleLike {
    if (!this.seal) {
      throw new Error('SEAL is not initialized')
    }

    if (!this.isSealModule(this.seal)) {
      throw new Error('Loaded module is not a valid SEAL module')
    }

    return this.seal
  }

  private isSealModule(value: unknown): value is SealModuleLike {
    if (typeof value !== 'object' || value === null) {
      return false
    }

    const contextFactory = getObjectProperty(value, 'Context')
    if (typeof contextFactory !== 'function') {
      return false
    }

    const securityLevel = getObjectProperty(value, 'SecurityLevel')
    if (typeof securityLevel !== 'object' || securityLevel === null) {
      return false
    }

    const schemeType = getObjectProperty(value, 'SchemeType')
    if (typeof schemeType !== 'object' || schemeType === null) {
      return false
    }

    const coeffModulus = getObjectProperty(value, 'CoeffModulus')
    if (typeof coeffModulus !== 'object' || coeffModulus === null) {
      return false
    }

    const plainModulus = getObjectProperty(value, 'PlainModulus')
    if (typeof plainModulus !== 'object' || plainModulus === null) {
      return false
    }

    return (
      typeof getObjectProperty(securityLevel, 'tc128') !== 'undefined' &&
      typeof getObjectProperty(securityLevel, 'tc192') !== 'undefined' &&
      typeof getObjectProperty(securityLevel, 'tc256') !== 'undefined' &&
      typeof getObjectProperty(schemeType, 'bfv') !== 'undefined' &&
      typeof getObjectProperty(schemeType, 'bgv') !== 'undefined' &&
      typeof getObjectProperty(schemeType, 'ckks') !== 'undefined' &&
      typeof getObjectProperty(value, 'EncryptionParameters') === 'function' &&
      typeof getObjectProperty(coeffModulus, 'Create') === 'function' &&
      typeof getObjectProperty(coeffModulus, 'BFVDefault') === 'function' &&
      typeof getObjectProperty(plainModulus, 'Batching') === 'function'
    )
  }

  /**
   * Map the security level enum to SEAL security level
   */
  private mapSecurityLevel(level: SealSecurityLevel): unknown {
    if (!this.seal) {
      throw new Error('SEAL is not initialized')
    }

    const sealModule = this.getValidatedSealModule()

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
  private createEncryptionParameters(): SealEncryptionParametersLike {
    if (!this.seal) {
      throw new Error('SEAL is not initialized')
    }

    const sealModule = this.getValidatedSealModule()

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
      const bitSizes = this.parameters.coeffModulusBits
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
        this.parameters.plainModulus ?? 20,
      )
      parms.setPlainModulus(plainMod)
    }

    return parms
  }

  /**
   * Log the encryption parameters for debugging
   */
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
      coeffModulusBits: this.parameters.coeffModulusBits,
      securityLevel: this.securityLevel,
      plainModulus: this.parameters.plainModulus,
      scale: this.parameters.scale,
    })

    logger.debug('SEAL context details:', {
      parametersSet: this.context?.parametersSet(),
      usingKeyswitching: this.context?.usingKeyswitching(),
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
      this.context.delete()
      this.context = null
    }

    if (this.encryptionParameters) {
      this.encryptionParameters.delete()
      this.encryptionParameters = null
    }

    this.initialized = false
  }
}
