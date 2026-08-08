/**
 * Microsoft SEAL Homomorphic Operations
 *
 * Provides high-level functions for performing homomorphic operations with SEAL
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { SealResourceScope } from './seal-memory'
import { SealService } from './seal-service'
import type { SealCipherText } from './seal-service'
import { SealSchemeType, SEAL_SUPPORTED_OPERATIONS } from './seal-types'
import type { SealOperationResult } from './seal-types'
import { FHEOperation, OperationError } from './types'

const logger = createBuildSafeLogger('seal-operations')

/**
 * Homomorphic operations using Microsoft SEAL
 */
export class SealOperations {
  private readonly service: SealService

  constructor(service?: SealService) {
    this.service = service ?? SealService.getInstance()
  }

  /**
   * Check if an operation is supported by the current scheme
   *
   * @param operation The operation to check
   * @returns True if the operation is supported
   */
  public isOperationSupported(operation: FHEOperation): boolean {
    const schemeType = this.service.getSchemeType()
    return SEAL_SUPPORTED_OPERATIONS[schemeType].includes(operation)
  }

  /**
   * Perform homomorphic addition
   *
   * @param a First ciphertext
   * @param b Second ciphertext or plaintext number array
   * @returns Result of the addition
   */
  public async add(
    a: SealCipherText,
    b: SealCipherText | number[],
  ): Promise<SealOperationResult> {
    try {
      if (!this.isOperationSupported(FHEOperation.Addition)) {
        throw new OperationError(
          `Addition not supported in scheme ${this.service.getSchemeType()}`,
        )
      }

      const scope = new SealResourceScope()
      const seal = this.service.getSeal()
      const evaluator = this.service.getEvaluator()

      // If b is a number array, encrypt it first
      let bOpCiphertext: SealCipherText
      if (Array.isArray(b)) {
        const bPlaintext = scope.track(seal.PlainText())
        const currentSchemeType = this.service.getSchemeType()
        const bNumArray: number[] = Array.from(b) // b is number[] in this scope, using Array.from
        if (currentSchemeType === SealSchemeType.CKKS) {
          const scale = BigInt(1) << BigInt(40) // Default CKKS scale
          const ckksEncoder = this.service.getCKKSEncoder()
          // Using number array
          ckksEncoder.encode(bNumArray, Number(scale), bPlaintext)
        } else {
          // BFV/BGV
          const batchEncoder = this.service.getBatchEncoder()
          // The batchEncoder.encode expects number[] and SealPlainText
          batchEncoder.encode(bNumArray, bPlaintext)
        }
        // Use the encryptor directly instead of the encrypt function
        const encryptor = this.service.getEncryptor()
        const tempCiphertext = scope.track(seal.CipherText())
        encryptor.encrypt(bPlaintext, tempCiphertext)
        bOpCiphertext = tempCiphertext
      } else {
        bOpCiphertext = scope.track(b)
      }

      const resultCiphertext = scope.track(seal.CipherText())
      evaluator.add(a, bOpCiphertext, resultCiphertext)

      // Create a new ciphertext to return (outside the scope)
      const finalResult = seal.CipherText()
      finalResult.copy(resultCiphertext)

      return {
        result: finalResult,
        success: true,
        operation: FHEOperation.Addition,
      }
    } catch (error: unknown) {
      logger.error('Homomorphic addition failed', { error })
      return {
        success: false,
        error: error instanceof Error ? String(error) : String(error),
        operation: FHEOperation.Addition,
      }
    }
  }

  /**
   * Perform homomorphic subtraction
   *
   * @param a First ciphertext
   * @param b Second ciphertext or plaintext number array
   * @returns Result of the subtraction
   */
  public async subtract(
    a: SealCipherText,
    b: SealCipherText | number[],
  ): Promise<SealOperationResult> {
    try {
      if (!this.isOperationSupported(FHEOperation.Subtraction)) {
        throw new OperationError(
          `Subtraction not supported in scheme ${this.service.getSchemeType()}`,
        )
      }

      const scope = new SealResourceScope()
      const seal = this.service.getSeal()
      const evaluator = this.service.getEvaluator()

      // If b is a number array, encrypt it first
      let bOpCiphertext: SealCipherText
      if (Array.isArray(b)) {
        const bPlaintext = scope.track(seal.PlainText())
        const currentSchemeType = this.service.getSchemeType()
        const bNumArray: number[] = Array.from(b) // b is number[] in this scope, using Array.from
        if (currentSchemeType === SealSchemeType.CKKS) {
          const scale = BigInt(1) << BigInt(40) // Default CKKS scale
          const ckksEncoder = this.service.getCKKSEncoder()
          // Using number array
          ckksEncoder.encode(bNumArray, Number(scale), bPlaintext)
        } else {
          // BFV/BGV
          const batchEncoder = this.service.getBatchEncoder()
          // The batchEncoder.encode expects number[] and SealPlainText
          batchEncoder.encode(bNumArray, bPlaintext)
        }
        // Use the encryptor directly instead of the encrypt function
        const encryptor = this.service.getEncryptor()
        const tempCiphertext = scope.track(seal.CipherText())
        encryptor.encrypt(bPlaintext, tempCiphertext)
        bOpCiphertext = tempCiphertext
      } else {
        bOpCiphertext = scope.track(b)
      }

      const resultCiphertext = scope.track(seal.CipherText())
      evaluator.sub(a, bOpCiphertext, resultCiphertext)

      // Create a new ciphertext to return (outside the scope)
      const finalResult = seal.CipherText()
      finalResult.copy(resultCiphertext)

      return {
        result: finalResult,
        success: true,
        operation: FHEOperation.Subtraction,
      }
    } catch (error: unknown) {
      logger.error('Homomorphic subtraction failed', { error })
      return {
        success: false,
        error: error instanceof Error ? String(error) : String(error),
        operation: FHEOperation.Subtraction,
      }
    }
  }

  /**
   * Perform homomorphic multiplication
   *
   * @param a First ciphertext
   * @param b Second ciphertext or plaintext number array
   * @returns Result of the multiplication
   */
  public async multiply(
    a: SealCipherText,
    b: SealCipherText | number[],
  ): Promise<SealOperationResult> {
    try {
      if (!this.isOperationSupported(FHEOperation.Multiplication)) {
        throw new OperationError(
          `Multiplication not supported in scheme ${this.service.getSchemeType()}`,
        )
      }

      const scope = new SealResourceScope()
      const seal = this.service.getSeal()
      const evaluator = this.service.getEvaluator()

      // Get relinearization keys (required for multiplication)
      const relinKeys = this.service.getRelinKeys()

      // If b is a number array, we can use plain multiplication which is more efficient
      if (Array.isArray(b)) {
        const bAsNumberArray = b // Explicit cast
        // Create a plaintext
        const plaintext = scope.track(seal.PlainText(), 'plaintext')

        // Encode the plaintext based on scheme
        if (this.service.getSchemeType() === SealSchemeType.CKKS) {
          // Default scale for CKKS
          const scale = BigInt(1) << BigInt(40)
          const ckksEncoder = this.service.getCKKSEncoder()
          ckksEncoder.encode(bAsNumberArray, Number(scale), plaintext)
        } else {
          const batchEncoder = this.service.getBatchEncoder()

          const { slotCount } = batchEncoder
          // Ensure the array has enough elements or pad with zeros
          const coefArray: number[] = new Array<number>(slotCount).fill(0)
          for (let i = 0; i < Math.min(bAsNumberArray.length, slotCount); i++) {
            if (typeof bAsNumberArray[i] !== 'number') {
              throw new TypeError(
                'Plaintext array for BFV/BGV multiplication must contain numbers. Received: ' +
                  String(bAsNumberArray[i]) +
                  ' of type ' +
                  typeof bAsNumberArray[i],
              )
            }
            coefArray[i] = bAsNumberArray[i]
          }
          batchEncoder.encode(coefArray, plaintext)
        }

        // Create result ciphertext
        const result = scope.track(seal.CipherText(), 'result')

        // Perform plain multiplication
        evaluator.multiplyPlain(a, plaintext, result)

        // Relinearize the result (reduce the size of ciphertext)
        const relinResult = scope.track(seal.CipherText(), 'relinResult')

        evaluator.relinearize(result, relinKeys, relinResult)

        // Create a new ciphertext to return (outside the scope)
        const finalResult = seal.CipherText()
        finalResult.copy(relinResult)

        return {
          result: finalResult,
          success: true,
          operation: FHEOperation.Multiplication,
        }
      } else {
        // Cipher-cipher multiplication
        // Create result ciphertext
        const result = scope.track(seal.CipherText(), 'result')

        // Perform multiplication
        evaluator.multiply(a, b, result)

        // Relinearize the result (reduce the size of ciphertext)
        const relinResult = scope.track(seal.CipherText(), 'relinResult')

        evaluator.relinearize(result, relinKeys, relinResult)

        // Create a new ciphertext to return (outside the scope)
        const finalResult = seal.CipherText()
        finalResult.copy(relinResult)

        return {
          result: finalResult,
          success: true,
          operation: FHEOperation.Multiplication,
        }
      }
    } catch (error: unknown) {
      logger.error('Homomorphic multiplication failed', { error })
      return {
        success: false,
        error: error instanceof Error ? String(error) : String(error),
        operation: FHEOperation.Multiplication,
      }
    }
  }

  /**
   * Negate a ciphertext
   *
   * @param a Ciphertext to negate
   * @returns Negated ciphertext
   */
  public async negate(a: SealCipherText): Promise<SealOperationResult> {
    try {
      if (!this.isOperationSupported(FHEOperation.Negation)) {
        throw new OperationError(
          `Negation not supported in scheme ${this.service.getSchemeType()}`,
        )
      }

      const scope = new SealResourceScope()
      const seal = this.service.getSeal()
      const evaluator = this.service.getEvaluator()

      // Create result ciphertext
      const result = scope.track(seal.CipherText(), 'result')

      // Perform negation
      evaluator.negate(a, result)

      // Create a new ciphertext to return (outside the scope)
      const finalResult = seal.CipherText()
      finalResult.copy(result)

      return {
        result: finalResult,
        success: true,
        operation: FHEOperation.Negation,
      }
    } catch (error: unknown) {
      logger.error('Homomorphic negation failed', { error })
      return {
        success: false,
        error: error instanceof Error ? String(error) : String(error),
        operation: FHEOperation.Negation,
      }
    }
  }

  /**
   * Rotate elements in a ciphertext (cyclic left rotation)
   *
   * @param a Ciphertext to rotate
   * @param steps Number of steps to rotate
   * @returns Rotated ciphertext
   */
  public async rotate(
    a: SealCipherText,
    steps: number,
  ): Promise<SealOperationResult> {
    try {
      if (!this.isOperationSupported(FHEOperation.Rotation)) {
        throw new OperationError(
          `Rotation not supported in scheme ${this.service.getSchemeType()}`,
        )
      }

      const scope = new SealResourceScope()
      const seal = this.service.getSeal()
      const evaluator = this.service.getEvaluator()

      // Get Galois keys (required for rotation)
      const galoisKeys = this.service.getGaloisKeys()
      // Create result ciphertext
      const result = scope.track(seal.CipherText(), 'result')

      // Perform rotation based on scheme
      if (this.service.getSchemeType() === SealSchemeType.CKKS) {
        // CKKS rotation
        evaluator.rotateVector(a, steps, galoisKeys, result)
      } else {
        // BFV/BGV rotation (row rotation for batched data)
        evaluator.rotateRows(a, steps, galoisKeys, result)
      }

      // Create a new ciphertext to return (outside the scope)
      const finalResult = seal.CipherText()
      finalResult.copy(result)

      return {
        result: finalResult,
        success: true,
        operation: FHEOperation.Rotation,
      }
    } catch (error: unknown) {
      logger.error('Homomorphic rotation failed', { error })
      return {
        success: false,
        error: error instanceof Error ? String(error) : String(error),
        operation: FHEOperation.Rotation,
      }
    }
  }

  /**
   * Square a ciphertext
   *
   * @param a Ciphertext to square
   * @returns Squared ciphertext
   */
  public async square(a: SealCipherText): Promise<SealOperationResult> {
    try {
      if (!this.isOperationSupported(FHEOperation.Square)) {
        throw new OperationError(
          `Square not supported in scheme ${this.service.getSchemeType()}`,
        )
      }

      const scope = new SealResourceScope()
      const seal = this.service.getSeal()
      const evaluator = this.service.getEvaluator()

      // Get relinearization keys (required for squaring)
      const relinKeys = this.service.getRelinKeys()
      // Create result ciphertext
      const result = scope.track(seal.CipherText(), 'result')

      // Perform squaring
      evaluator.square(a, result)

      // Relinearize the result
      const relinResult = scope.track(seal.CipherText(), 'relinResult')

      evaluator.relinearize(result, relinKeys, relinResult)

      // Create a new ciphertext to return (outside the scope)
      const finalResult = seal.CipherText()
      finalResult.copy(relinResult)

      return {
        result: finalResult,
        success: true,
        operation: FHEOperation.Square,
      }
    } catch (error: unknown) {
      logger.error('Homomorphic squaring failed', { error })
      return {
        success: false,
        error: error instanceof Error ? String(error) : String(error),
        operation: FHEOperation.Square,
      }
    }
  }

  /**
   * Compute a dot product on a ciphertext and another ciphertext or plaintext array
   *
   * @param a Ciphertext to multiply
   * @param b Second ciphertext or plaintext number array
   * @returns Dot product result (sum of element-wise multiplication in all slots)
   */
  public async dotProduct(
    a: SealCipherText,
    b: SealCipherText | number[],
  ): Promise<SealOperationResult> {
    try {
      if (!this.isOperationSupported(FHEOperation.DotProduct)) {
        throw new OperationError(
          `Dot product not supported in scheme ${this.service.getSchemeType()}`,
        )
      }

      const scope = new SealResourceScope()

      // 1. Element-wise multiply
      const multResult = await this.multiply(a, b)
      if (!multResult.success || !multResult.result) {
        return {
          ...multResult,
          operation: FHEOperation.DotProduct,
        }
      }

      let sumCipher = multResult.result as SealCipherText
      scope.track(sumCipher)

      // 2. Reduce by summing slots
      const scheme = this.service.getSchemeType()
      let slotCount = 0
      if (scheme === SealSchemeType.CKKS) {
        slotCount = this.service.getCKKSEncoder().slotCount
      } else {
        slotCount = this.service.getBatchEncoder().slotCount
      }

      const logSlots = Math.ceil(Math.log2(slotCount))
      for (let i = 0; i < logSlots; i++) {
        const rotResult = await this.rotate(sumCipher, 2 ** i)
        if (!rotResult.success || !rotResult.result) continue

        const rotCipher = rotResult.result as SealCipherText
        scope.track(rotCipher)

        const addResult = await this.add(sumCipher, rotCipher)
        if (addResult.success && addResult.result) {
          sumCipher = addResult.result as SealCipherText
          scope.track(sumCipher)
        }
      }

      const seal = this.service.getSeal()
      const finalResult = seal.CipherText()
      finalResult.copy(sumCipher)

      return {
        result: finalResult,
        success: true,
        operation: FHEOperation.DotProduct,
      }
    } catch (error: unknown) {
      logger.error('Homomorphic dot product failed', { error })
      return {
        success: false,
        error: error instanceof Error ? String(error) : String(error),
        operation: FHEOperation.DotProduct,
      }
    }
  }

  /**
   * Compute a polynomial on a ciphertext
   *
   * @param a Ciphertext input
   * @param coefficients Coefficients of the polynomial (index i is for x^i)
   * @returns Result of the polynomial evaluation
   */
  public async polynomial(
    a: SealCipherText,
    coefficients: number[],
  ): Promise<SealOperationResult> {
    try {
      // Polynomial evaluation requires addition and multiplication
      if (
        !this.isOperationSupported(FHEOperation.Addition) ||
        !this.isOperationSupported(FHEOperation.Multiplication)
      ) {
        throw new OperationError(
          `Polynomial evaluation not supported in scheme ${this.service.getSchemeType()}`,
        )
      }

      if (coefficients.length === 0) {
        throw new Error('Coefficients array cannot be empty')
      }

      const scope = new SealResourceScope()
      const evaluator = this.service.getEvaluator()
      const relinKeys = this.service.getRelinKeys()

      // Relin keys were verified by getRelinKeys()

      // If only a0 is provided, return the constant
      if (coefficients.length === 1) {
        const seal = this.service.getSeal()
        // Create a plaintext for the constant
        const plaintext = scope.track(seal.PlainText(), 'plaintext')
        const currentSchemeType = this.service.getSchemeType()
        // Encode the constant based on scheme
        if (currentSchemeType === SealSchemeType.CKKS) {
          const scale = Number(BigInt(1) << BigInt(40))
          const ckksEncoder = this.service.getCKKSEncoder()
          const currentCoeff: number[] = [coefficients[0]]
          // Using array with single coefficient
          ckksEncoder.encode(currentCoeff, scale, plaintext)
        } else {
          // For BFV/BGV, we need to create an array of the same size as the batch
          const batchEncoder = this.service.getBatchEncoder()
          const { slotCount } = batchEncoder
          const constArray: number[] = Array.from(
            { length: slotCount },
            () => coefficients[0],
          )
          batchEncoder.encode(constArray, plaintext)
        }
        const result = seal.CipherText()
        this.service.getEncryptor().encrypt(plaintext, result)

        return {
          result,
          success: true,
          operation: FHEOperation.Polynomial,
        }
      }

      // Start with the highest degree coefficient
      let n = coefficients.length - 1

      // Get SEAL instance once and reuse it
      const seal = this.service.getSeal()
      // Encode the highest coefficient
      const highestCoef = scope.track(seal.PlainText(), 'highestCoef')
      const currentSchemeType = this.service.getSchemeType()

      if (currentSchemeType === SealSchemeType.CKKS) {
        const scale = BigInt(1) << BigInt(40)
        const ckksEncoder = this.service.getCKKSEncoder()
        // Using array with single coefficient
        ckksEncoder.encode([coefficients[n]], Number(scale), highestCoef)
      } else {
        const batchEncoder = this.service.getBatchEncoder()
        const { slotCount } = batchEncoder
        const coefArray: number[] = new Array<number>(slotCount).fill(
          coefficients[n],
        )
        batchEncoder.encode(coefArray, highestCoef)
      }

      // Initialize result with the highest coefficient
      let resultCiphertext = scope.track(seal.CipherText(), 'resultCiphertext')

      this.service.getEncryptor().encrypt(highestCoef, resultCiphertext)

      // Process remaining coefficients using Horner's method
      for (let i = n - 1; i >= 0; i--) {
        // Multiply by x
        const afterMult = scope.track(seal.CipherText(), 'afterMult')

        evaluator.multiply(resultCiphertext, a, afterMult)

        // Relinearize after multiplication
        const afterRelin = scope.track(seal.CipherText(), 'afterRelin')

        evaluator.relinearize(afterMult, relinKeys, afterRelin)

        // Add the next coefficient
        const nextCoef = scope.track(seal.PlainText(), 'nextCoef')

        if (currentSchemeType === SealSchemeType.CKKS) {
          const scale = BigInt(1) << BigInt(40)
          const ckksEncoder = this.service.getCKKSEncoder()
          ckksEncoder.encode([coefficients[i]], Number(scale), nextCoef)
        } else {
          const batchEncoder = this.service.getBatchEncoder()
          const { slotCount } = batchEncoder
          const coefArray: number[] = new Array<number>(slotCount).fill(
            coefficients[i],
          )
          batchEncoder.encode(coefArray, nextCoef)
        }

        const afterAdd = scope.track(seal.CipherText(), 'afterAdd')

        evaluator.addPlain(afterRelin, nextCoef, afterAdd)

        // Update result
        resultCiphertext = afterAdd
      }

      // Create a new ciphertext to return (outside the scope)
      const finalResult = seal.CipherText()
      finalResult.copy(resultCiphertext)

      return {
        result: finalResult,
        success: true,
        operation: FHEOperation.Polynomial,
      }
    } catch (error: unknown) {
      logger.error('Homomorphic polynomial evaluation failed', { error })
      return {
        success: false,
        error: error instanceof Error ? String(error) : String(error),
        operation: FHEOperation.Polynomial,
      }
    }
  }
}
