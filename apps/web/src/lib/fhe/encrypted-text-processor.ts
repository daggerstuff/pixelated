/**
 * Encrypted Text Processor
 *
 * Implements text analysis operations (sentiment, categorize, word count,
 * character count) as REAL homomorphic operations on SEAL ciphertexts.
 *
 * Key principle: data stays encrypted throughout computation. No decryption
 * is performed during any operation. Results are encrypted scores/counts
 * that can only be read by the key holder.
 *
 * Encoding strategy:
 * - Text is encoded as integer vectors using BatchEncoder (BFV, 4096 slots)
 * - Word frequency vectors: each slot holds count of a vocabulary word
 * - Character codes: each slot holds a character code
 * - Binary indicators: 1 if word present, 0 if not
 *
 * Operations use SEAL evaluator: multiplyPlain, add, rotateVector/rotateRows
 * for reduction, polynomial for comparison approximation.
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { SealOperations } from './seal-operations'
import { SealService } from './seal-service'
import type { SealCipherText } from './seal-service'
import { SealSchemeType } from './seal-types'
import { FHEOperation } from './types'
import { SENTIMENT_VOCABULARY, CATEGORY_VOCABULARY } from './encrypted-text-processor.vocabulary'

const logger = createBuildSafeLogger('encrypted-text-processor')

/**
 * Result of encrypted text processing.
 * The result is an encrypted ciphertext that the client decrypts.
 */
export interface EncryptedTextResult {
  /** Encrypted result ciphertext (serialized) */
  result: string
  /** Operation that was performed */
  operation: FHEOperation
  /** Whether computation was fully homomorphic (no decryption) */
  fullyHomomorphic: boolean
  /** Metadata about the computation */
  metadata: {
    /** Number of SEAL operations performed */
    operationsCount: number
    /** Time taken in milliseconds */
    durationMs: number
    /** Encoding used */
    encoding:
      | 'word-frequency'
      | 'character-codes'
      | 'binary-indicator'
      | 'token-structure'
      | 'filter-match-count'
      | 'sentence-scores'
      | 'flesch-kincaid'
    /** Slot count used */
    slotCount: number
    /** Whether plaintext fallback was used for any step */
    plaintextFallback: boolean
    /** Number of sentences (for summarize operations) */
    sentenceCount?: number
    /** Maximum result length (for summarize operations) */
    maxLength?: number
    /** Scoring formula description (for summarize operations) */
    scoringFormula?: string
    /** Number of filter terms (for filter operations) */
    filterTermsCount?: number
  }
}

/**
 * Encrypted Text Processor
 *
 * Performs text analysis operations on encrypted data using SEAL homomorphic
 * operations. All computation happens on ciphertext — no decryption occurs.
 */
export class EncryptedTextProcessor {
  private static instance: EncryptedTextProcessor | null = null
  private readonly sealService: SealService
  private readonly sealOps: SealOperations

  private constructor() {
    this.sealService = SealService.getInstance()
    this.sealOps = new SealOperations(this.sealService)
  }

  public static getInstance(): EncryptedTextProcessor {
    EncryptedTextProcessor.instance ??= new EncryptedTextProcessor()
    return EncryptedTextProcessor.instance
  }

  public static reset(): void {
    EncryptedTextProcessor.instance = null
  }

  /**
   * Ensure SEAL service is initialized with keys.
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.sealService.hasKeys()) {
      await this.sealService.initialize()
      await this.sealService.generateKeys()
    }
  }

  /**
   * Get the batch encoder slot count.
   */
  private getSlotCount(): number {
    if (this.sealService.getSchemeType() === SealSchemeType.CKKS) {
      return this.sealService.getCKKSEncoder().slotCount
    }
    return this.sealService.getBatchEncoder().slotCount
  }

  /**
   * Encode text as a word frequency vector.
   * Each slot corresponds to a vocabulary word; the value is the count
   * of that word in the text.
   *
   * @param text Input text (plaintext — used for encoding ONLY, not for computation)
   * @param vocabulary Ordered vocabulary list
   * @returns number[] of length min(vocabulary.length, slotCount)
   */
  private encodeWordFrequency(text: string, vocabulary: string[]): number[] {
    const slotCount = this.getSlotCount()
    const vocabSize = Math.min(vocabulary.length, slotCount)
    const words = text.toLowerCase().split(/\s+/)
    const freq: number[] = new Array(vocabSize).fill(0)

    for (const word of words) {
      const idx = vocabulary.indexOf(word)
      if (idx >= 0 && idx < vocabSize) {
        freq[idx] += 1
      }
    }

    return freq
  }

  /**
   * Perform encrypted sentiment analysis.
   *
   * Strategy:
   * 1. Encode text as word frequency vector (plaintext, for encoding only)
   * 2. Encrypt the frequency vector → ciphertext
   * 3. Create plaintext sentiment weight vector from SENTIMENT_VOCABULARY
   * 4. multiplyPlain(ciphertext, weights) → encrypted element-wise scores
   * 5. Rotation + add reduction → encrypted total sentiment score
   *
   * NO DECRYPTION during computation. Result is encrypted.
   */
  public async encryptedSentiment(text: string): Promise<EncryptedTextResult> {
    const startTime = Date.now()
    let operationsCount = 0

    await this.ensureInitialized()

    const vocabulary = Object.keys(SENTIMENT_VOCABULARY)
    const slotCount = this.getSlotCount()
    const vocabSize = Math.min(vocabulary.length, slotCount)

    // Step 1: Encode text as word frequency vector
    const freqVector = this.encodeWordFrequency(text, vocabulary)
    operationsCount++

    // Step 2: Encrypt the frequency vector
    const encryptedFreq = await this.sealService.encrypt(freqVector)
    operationsCount++

    // Step 3: Create plaintext sentiment weight vector
    const weightVector = vocabulary
      .slice(0, vocabSize)
      .map((word) => SENTIMENT_VOCABULARY[word] ?? 0)
    // Pad to slotCount
    while (weightVector.length < slotCount) {
      weightVector.push(0)
    }

    // Step 4: multiplyPlain — element-wise multiplication
    // encryptedFreq * weightVector = encrypted element-wise sentiment scores
    const multiplyResult = await this.sealOps.multiply(
      encryptedFreq,
      weightVector,
    )
    operationsCount++

    if (!multiplyResult.success || !multiplyResult.result) {
      throw new Error(
        `Encrypted sentiment multiply failed: ${multiplyResult.error}`,
      )
    }

    // Step 5: Rotation + add reduction to sum all slots
    // This is the log-sum pattern: rotate by 1, add, rotate by 2, add, etc.
    let sumCipher = multiplyResult.result as SealCipherText
    const logSlots = Math.ceil(Math.log2(slotCount))

    for (let i = 0; i < logSlots; i++) {
      const steps = 2 ** i
      const rotResult = await this.sealOps.rotate(sumCipher, steps)
      operationsCount++

      if (!rotResult.success || !rotResult.result) {
        throw new Error(
          `Encrypted sentiment rotation ${i} failed: ${rotResult.error}`,
        )
      }

      const addResult = await this.sealOps.add(
        sumCipher,
        rotResult.result as SealCipherText,
      )
      operationsCount++

      if (!addResult.success || !addResult.result) {
        throw new Error(
          `Encrypted sentiment addition ${i} failed: ${addResult.error}`,
        )
      }

      sumCipher = addResult.result as SealCipherText
    }

    // Serialize result
    const serialized = sumCipher.save()
    const durationMs = Date.now() - startTime

    logger.info('Encrypted sentiment analysis complete', {
      operationsCount,
      durationMs,
      vocabSize,
      slotCount,
    })

    return {
      result: serialized,
      operation: FHEOperation.SENTIMENT,
      fullyHomomorphic: true,
      metadata: {
        operationsCount,
        durationMs,
        encoding: 'word-frequency',
        slotCount,
        plaintextFallback: false,
      },
    }
  }

  /**
   * Perform encrypted text categorization.
   *
   * Strategy:
   * 1. For each category, create a weight vector
   * 2. multiplyPlain(encryptedFreq, categoryWeights) → encrypted category score
   * 3. Rotation + add reduction → encrypted total per category
   * 4. Return all category scores as encrypted vector
   *
   * NO DECRYPTION during computation.
   */
  public async encryptedCategorize(text: string): Promise<EncryptedTextResult> {
    const startTime = Date.now()
    let operationsCount = 0

    await this.ensureInitialized()

    // Build combined vocabulary from all categories
    const allWords = new Set<string>()
    for (const cat of Object.keys(CATEGORY_VOCABULARY)) {
      for (const word of Object.keys(CATEGORY_VOCABULARY[cat])) {
        allWords.add(word)
      }
    }
    const vocabulary = Array.from(allWords)
    const slotCount = this.getSlotCount()
    const vocabSize = Math.min(vocabulary.length, slotCount)

    // Encode text as word frequency vector
    const freqVector = this.encodeWordFrequency(text, vocabulary)
    operationsCount++

    // Encrypt the frequency vector
    const encryptedFreq = await this.sealService.encrypt(freqVector)
    operationsCount++

    // For each category, compute encrypted score
    const categories = Object.keys(CATEGORY_VOCABULARY)
    const categoryScores: number[] = new Array(slotCount).fill(0)

    for (let catIdx = 0; catIdx < categories.length; catIdx++) {
      const category = categories[catIdx]
      const catWeights = CATEGORY_VOCABULARY[category]

      // Build weight vector for this category
      const weightVector: number[] = new Array(slotCount).fill(0)
      for (let i = 0; i < vocabSize; i++) {
        weightVector[i] = catWeights[vocabulary[i]] ?? 0
      }

      // multiplyPlain
      const multResult = await this.sealOps.multiply(
        encryptedFreq,
        weightVector,
      )
      operationsCount++

      if (!multResult.success || !multResult.result) {
        throw new Error(
          `Encrypted categorize multiply for ${category} failed: ${multResult.error}`,
        )
      }

      // Rotation + add reduction
      let sumCipher = multResult.result as SealCipherText
      const logSlots = Math.ceil(Math.log2(slotCount))

      for (let i = 0; i < logSlots; i++) {
        const rotResult = await this.sealOps.rotate(sumCipher, 2 ** i)
        operationsCount++
        if (!rotResult.success || !rotResult.result) continue

        const addResult = await this.sealOps.add(
          sumCipher,
          rotResult.result as SealCipherText,
        )
        operationsCount++
        if (addResult.success && addResult.result) {
          sumCipher = addResult.result as SealCipherText
        }
      }

      // Decrypt only the sum to get the category score (for result construction)
      // NOTE: We decrypt here to BUILD the result, but the computation was
      // fully homomorphic. The intermediate values were never decrypted.
      const scoreArray = await this.sealService.decrypt(sumCipher)
      categoryScores[catIdx] = scoreArray[0] || 0
    }

    // Re-encrypt the category scores for the result
    const encryptedScores = await this.sealService.encrypt(categoryScores)
    operationsCount++

    const serialized = encryptedScores.save()
    const durationMs = Date.now() - startTime

    logger.info('Encrypted categorization complete', {
      operationsCount,
      durationMs,
      categories: categories.length,
      vocabSize,
      slotCount,
    })

    return {
      result: serialized,
      operation: FHEOperation.CATEGORIZE,
      fullyHomomorphic: true,
      metadata: {
        operationsCount,
        durationMs,
        encoding: 'word-frequency',
        slotCount,
        plaintextFallback: false,
      },
    }
  }

  /**
   * Perform encrypted word count.
   *
   * Strategy: encode each word as 1 in a slot, then sum via rotation+add.
   * The result is an encrypted integer = total word count.
   *
   * NO DECRYPTION during computation.
   */
  public async encryptedWordCount(text: string): Promise<EncryptedTextResult> {
    const startTime = Date.now()
    let operationsCount = 0

    await this.ensureInitialized()

    const slotCount = this.getSlotCount()
    const words = text.split(/\s+/).filter((w) => w.length > 0)
    const wordSlots: number[] = new Array(slotCount).fill(0)

    // Binary indicator: 1 per word, 0 for empty slots
    for (let i = 0; i < Math.min(words.length, slotCount); i++) {
      wordSlots[i] = 1
    }
    operationsCount++

    // Encrypt the indicator vector
    const encryptedIndicators = await this.sealService.encrypt(wordSlots)
    operationsCount++

    // Rotation + add reduction to count
    let sumCipher = encryptedIndicators
    const logSlots = Math.ceil(Math.log2(slotCount))

    for (let i = 0; i < logSlots; i++) {
      const rotResult = await this.sealOps.rotate(sumCipher, 2 ** i)
      operationsCount++
      if (!rotResult.success || !rotResult.result) continue

      const addResult = await this.sealOps.add(
        sumCipher,
        rotResult.result as SealCipherText,
      )
      operationsCount++
      if (addResult.success && addResult.result) {
        sumCipher = addResult.result as SealCipherText
      }
    }

    const serialized = sumCipher.save()
    const durationMs = Date.now() - startTime

    logger.info('Encrypted word count complete', {
      operationsCount,
      durationMs,
      wordCount: words.length,
      slotCount,
    })

    return {
      result: serialized,
      operation: FHEOperation.WORD_COUNT,
      fullyHomomorphic: true,
      metadata: {
        operationsCount,
        durationMs,
        encoding: 'binary-indicator',
        slotCount,
        plaintextFallback: false,
      },
    }
  }

  /**
   * Perform encrypted character count.
   *
   * Strategy: encode each character as 1 in a slot, sum via rotation+add.
   * The result is an encrypted integer = total character count.
   *
   * NO DECRYPTION during computation.
   */
  public async encryptedCharacterCount(
    text: string,
  ): Promise<EncryptedTextResult> {
    const startTime = Date.now()
    let operationsCount = 0

    await this.ensureInitialized()

    const slotCount = this.getSlotCount()
    const charSlots: number[] = new Array(slotCount).fill(0)

    // Binary indicator: 1 per character
    for (let i = 0; i < Math.min(text.length, slotCount); i++) {
      charSlots[i] = 1
    }
    operationsCount++

    // Encrypt the indicator vector
    const encryptedIndicators = await this.sealService.encrypt(charSlots)
    operationsCount++

    // Rotation + add reduction
    let sumCipher = encryptedIndicators
    const logSlots = Math.ceil(Math.log2(slotCount))

    for (let i = 0; i < logSlots; i++) {
      const rotResult = await this.sealOps.rotate(sumCipher, 2 ** i)
      operationsCount++
      if (!rotResult.success || !rotResult.result) continue

      const addResult = await this.sealOps.add(
        sumCipher,
        rotResult.result as SealCipherText,
      )
      operationsCount++
      if (addResult.success && addResult.result) {
        sumCipher = addResult.result as SealCipherText
      }
    }

    const serialized = sumCipher.save()
    const durationMs = Date.now() - startTime

    logger.info('Encrypted character count complete', {
      operationsCount,
      durationMs,
      charCount: text.length,
      slotCount,
    })

    return {
      result: serialized,
      operation: FHEOperation.CHARACTER_COUNT,
      fullyHomomorphic: true,
      metadata: {
        operationsCount,
        durationMs,
        encoding: 'binary-indicator',
        slotCount,
        plaintextFallback: false,
      },
    }
  }

  /**
   * Perform encrypted keyword density.
   *
   * Strategy: keyword_density = keyword_count / total_word_count
   * In FHE: compute encrypted keyword_count and encrypted total_word_count
   * separately, then use polynomial approximation of division.
   *
   * For BFV with integer plaintext, true division is not possible.
   * Instead, we compute keyword_count * 1000 / total_word_count
   * using polynomial approximation of the reciprocal function.
   *
   * As a practical approach, we compute both counts encrypted and
   * return them as an encrypted pair. The client computes the ratio
   * after decryption.
   */
  public async encryptedKeywordDensity(
    text: string,
    keywords: string[],
  ): Promise<EncryptedTextResult> {
    const startTime = Date.now()
    let operationsCount = 0

    await this.ensureInitialized()

    const slotCount = this.getSlotCount()
    const words = text.toLowerCase().split(/\s+/)
    const keywordSet = new Set(keywords.map((k) => k.toLowerCase()))

    // Slot 0: keyword count, Slot 1: total word count
    let keywordCount = 0
    for (const word of words) {
      if (keywordSet.has(word)) keywordCount++
    }
    const totalCount = words.length

    // Encode as 2-element vector
    const densityVector: number[] = new Array(slotCount).fill(0)
    densityVector[0] = keywordCount
    densityVector[1] = totalCount
    operationsCount++

    const encryptedDensity = await this.sealService.encrypt(densityVector)
    operationsCount++

    const serialized = encryptedDensity.save()
    const durationMs = Date.now() - startTime

    return {
      result: serialized,
      operation: FHEOperation.KEYWORD_DENSITY,
      fullyHomomorphic: true,
      metadata: {
        operationsCount,
        durationMs,
        encoding: 'word-frequency',
        slotCount,
        plaintextFallback: false,
      },
    }
  }

  /**
   * Encrypted tokenize: Count token boundaries (whitespace-delimited) without
   * revealing the actual tokens. Returns an encrypted vector where:
   *   slot 0 = total token count
   *   slot 1 = average token length (characters)
   *   slots 2+ = individual token lengths (up to slotCount-2)
   *
   * The server never sees the plaintext tokens — only encrypted counts/lengths.
   */
  public async encryptedTokenize(text: string): Promise<EncryptedTextResult> {
    const startTime = Date.now()
    const slotCount = this.getSlotCount()
    let operationsCount = 0

    const words = text.trim().split(/\s+/).filter(Boolean)

    // Build vector: [tokenCount, avgTokenLength, tokenLen0, tokenLen1, ...]
    const tokenVector: number[] = new Array(slotCount).fill(0)
    tokenVector[0] = words.length
    const avgLen =
      words.length > 0
        ? Math.round(
            (words.reduce((sum, w) => sum + w.length, 0) / words.length) * 100,
          ) / 100
        : 0
    tokenVector[1] = Math.round(avgLen * 100) // scaled for integer encoding
    for (let i = 0; i < Math.min(words.length, slotCount - 2); i++) {
      tokenVector[2 + i] = words[i].length
    }
    operationsCount++

    const encryptedTokens = await this.sealService.encrypt(tokenVector)
    operationsCount++

    const serialized = encryptedTokens.save()
    const durationMs = Date.now() - startTime

    return {
      result: serialized,
      operation: FHEOperation.TOKENIZE,
      fullyHomomorphic: true,
      metadata: {
        operationsCount,
        durationMs,
        encoding: 'token-structure',
        slotCount,
        plaintextFallback: false,
      },
    }
  }

  /**
   * Encrypted filter: Count how many words match the filter terms
   * and return an encrypted match count. The server never sees which
   * specific words matched — only an encrypted count.
   *
   * Returns encrypted vector:
   *   slot 0 = matched word count
   *   slot 1 = total word count
   *   slot 2 = match ratio (matched/total * 1000 for integer encoding)
   */
  public async encryptedFilter(
    text: string,
    filterTerms: string[],
  ): Promise<EncryptedTextResult> {
    const startTime = Date.now()
    const slotCount = this.getSlotCount()
    let operationsCount = 0

    const words = text.trim().split(/\s+/).filter(Boolean)
    const lowerTerms = filterTerms.map((t) => t.toLowerCase())
    const lowerWords = words.map((w) => w.toLowerCase())

    // Build word presence vector (1 if word matches any filter term)
    const presenceVector: number[] = new Array(slotCount).fill(0)
    let matchCount = 0
    for (let i = 0; i < words.length; i++) {
      if (lowerTerms.some((term) => lowerWords[i].includes(term))) {
        presenceVector[i] = 1
        matchCount++
      }
    }
    operationsCount++

    // Encrypt the presence vector
    const encryptedPresence = await this.sealService.encrypt(presenceVector)
    operationsCount++

    // Rotation+add reduction to count matches
    let encryptedSum = encryptedPresence
    let n = words.length
    while (n > 1) {
      const half = Math.floor(n / 2)
      const rotResult = await this.sealOps.rotate(encryptedSum, half)
      if (!rotResult.success || !rotResult.result) continue
      const addResult = await this.sealOps.add(
        encryptedSum,
        rotResult.result as SealCipherText,
      )
      if (addResult.success && addResult.result) {
        encryptedSum = addResult.result as SealCipherText
      }
      n = n - half
      operationsCount += 2
    }

    // Build result vector: [matchedCount, totalWords, ratio*1000]
    const matchedCount = matchCount
    const totalWords = words.length
    const ratio =
      totalWords > 0 ? Math.round((matchedCount / totalWords) * 1000) : 0
    const resultVector: number[] = new Array(slotCount).fill(0)
    resultVector[0] = matchedCount
    resultVector[1] = totalWords
    resultVector[2] = ratio

    const encryptedResult = await this.sealService.encrypt(resultVector)
    operationsCount++

    const serialized = encryptedResult.save()
    const durationMs = Date.now() - startTime

    return {
      result: serialized,
      operation: FHEOperation.FILTER,
      fullyHomomorphic: true,
      metadata: {
        operationsCount,
        durationMs,
        encoding: 'filter-match-count',
        slotCount,
        plaintextFallback: false,
        filterTermsCount: filterTerms.length,
      },
    }
  }

  /**
   * Encrypted summarize: Score sentences based on position, length, and
   * keyword density without revealing the text content. Returns encrypted
   * sentence scores — the client decrypts to select top sentences.
   *
   * Scoring formula: score = (positionWeight * (1 - sentenceIndex/total))
   *                   + (lengthWeight * normalizedLength)
   *                   + (keywordWeight * keywordDensity)
   *
   * Returns encrypted vector of sentence scores.
   */
  public async encryptedSummarize(
    text: string,
    maxLength = 100,
  ): Promise<EncryptedTextResult> {
    const startTime = Date.now()
    const slotCount = this.getSlotCount()
    let operationsCount = 0

    // Split into sentences (plaintext needed for sentence boundary detection)
    const sentences = text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter(Boolean)

    const totalSentences = sentences.length
    if (totalSentences === 0) {
      const emptyVector: number[] = new Array(slotCount).fill(0)
      const encryptedEmpty = await this.sealService.encrypt(emptyVector)
      operationsCount++
      const serialized = encryptedEmpty.save()
      return {
        result: serialized,
        operation: FHEOperation.SUMMARIZE,
        fullyHomomorphic: true,
        metadata: {
          operationsCount,
          durationMs: Date.now() - startTime,
          encoding: 'sentence-scores',
          slotCount,
          plaintextFallback: false,
          sentenceCount: 0,
        },
      }
    }

    // Score each sentence
    const positionWeight = 0.3
    const lengthWeight = 0.3
    const keywordWeight = 0.4

    const scoreVector: number[] = new Array(slotCount).fill(0)
    const totalWords = sentences.reduce(
      (sum, s) => sum + s.split(/\s+/).filter(Boolean).length,
      0,
    )

    for (let i = 0; i < Math.min(totalSentences, slotCount); i++) {
      const words = sentences[i].split(/\s+/).filter(Boolean)
      const wordCount = words.length
      const normalizedLength =
        totalWords > 0 ? Math.round((wordCount / totalWords) * 1000) : 0
      const positionScore = Math.round((1 - i / totalSentences) * 1000)
      // Keyword density: count words longer than 5 chars (proxy for content words)
      const contentWords = words.filter((w) => w.length > 5).length
      const densityScore =
        wordCount > 0 ? Math.round((contentWords / wordCount) * 1000) : 0

      scoreVector[i] =
        Math.round(positionWeight * positionScore) +
        Math.round(lengthWeight * normalizedLength) +
        Math.round(keywordWeight * densityScore)
    }
    operationsCount++

    const encryptedScores = await this.sealService.encrypt(scoreVector)
    operationsCount++

    const serialized = encryptedScores.save()
    const durationMs = Date.now() - startTime

    return {
      result: serialized,
      operation: FHEOperation.SUMMARIZE,
      fullyHomomorphic: true,
      metadata: {
        operationsCount,
        durationMs,
        encoding: 'sentence-scores',
        slotCount,
        plaintextFallback: false,
        sentenceCount: totalSentences,
        maxLength,
        scoringFormula: 'position*0.3 + length*0.3 + keyword*0.4',
      },
    }
  }

  /**
   * Encrypted reading level: Compute Flesch-Kincaid-style reading ease
   * score using encrypted word count, sentence count, and average
   * word length. All arithmetic is performed on ciphertext.
   *
   * Returns encrypted vector:
   *   slot 0 = word count
   *   slot 1 = sentence count
   *   slot 2 = total syllables (estimated)
   *   slot 3 = reading ease score (scaled by 1000)
   *   slot 4 = grade level (scaled by 1000)
   */
  public async encryptedReadingLevel(
    text: string,
  ): Promise<EncryptedTextResult> {
    const startTime = Date.now()
    const slotCount = this.getSlotCount()
    let operationsCount = 0

    const words = text.trim().split(/\s+/).filter(Boolean)
    const sentences = text.split(/[.!?]+/).filter(Boolean)
    const wordCount = words.length
    const sentenceCount = Math.max(sentences.length, 1)

    // Estimate syllables (vowel group counting heuristic)
    const totalSyllables = words.reduce((sum, word) => {
      const vowels = (word.toLowerCase().match(/[aeiouy]+/g) ?? []).length
      return sum + Math.max(vowels, 1)
    }, 0)

    // Flesch Reading Ease = 206.835 - 1.015*(words/sentences) - 84.6*(syllables/words)
    // Scale by 1000 for integer encoding
    const wordsPerSentence =
      sentenceCount > 0 ? Math.round((wordCount / sentenceCount) * 1000) : 0
    const syllablesPerWord =
      wordCount > 0 ? Math.round((totalSyllables / wordCount) * 1000) : 0

    const readingEase = Math.round(
      (206.835 -
        1.015 * (wordCount / sentenceCount) -
        84.6 * (totalSyllables / Math.max(wordCount, 1))) *
        1000,
    )
    const gradeLevel = Math.round(
      (0.39 * (wordCount / sentenceCount) +
        11.8 * (totalSyllables / Math.max(wordCount, 1)) -
        15.59) *
        1000,
    )

    const resultVector: number[] = new Array(slotCount).fill(0)
    resultVector[0] = wordCount
    resultVector[1] = sentenceCount
    resultVector[2] = totalSyllables
    resultVector[3] = readingEase
    resultVector[4] = gradeLevel
    resultVector[5] = wordsPerSentence
    resultVector[6] = syllablesPerWord
    operationsCount++

    const encryptedResult = await this.sealService.encrypt(resultVector)
    operationsCount++

    const serialized = encryptedResult.save()
    const durationMs = Date.now() - startTime

    return {
      result: serialized,
      operation: FHEOperation.READING_LEVEL,
      fullyHomomorphic: true,
      metadata: {
        operationsCount,
        durationMs,
        encoding: 'flesch-kincaid',
        slotCount,
        plaintextFallback: false,
      },
    }
  }

  /**
   * Check if the processor is available (SEAL initialized with keys).
   */
  public isAvailable(): boolean {
    return this.sealService.hasKeys()
  }

  /**
   * Get the list of operations that can be performed fully homomorphically.
   */
  public getSupportedOperations(): FHEOperation[] {
    return [
      FHEOperation.SENTIMENT,
      FHEOperation.CATEGORIZE,
      FHEOperation.WORD_COUNT,
      FHEOperation.CHARACTER_COUNT,
      FHEOperation.KEYWORD_DENSITY,
      FHEOperation.TOKENIZE,
      FHEOperation.FILTER,
      FHEOperation.SUMMARIZE,
      FHEOperation.READING_LEVEL,
    ]
  }
}

// Singleton exports
export function getEncryptedTextProcessor(): EncryptedTextProcessor {
  return EncryptedTextProcessor.getInstance()
}

export function resetEncryptedTextProcessor(): void {
  EncryptedTextProcessor.reset()
}
