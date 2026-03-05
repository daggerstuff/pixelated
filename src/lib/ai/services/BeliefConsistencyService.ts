import type { PatientProfile } from '../models/patient'

/**
 * Result of a consistency check
 */
export type ConsistencyResult = {
  isConsistent: boolean
  contradictionsFound: Array<{
    type: 'belief' | 'statement'
    conflictingText: string // The existing belief or statement text
    similarityScore?: number // Optional: score from a similarity algorithm
    explanation?: string // Optional: brief explanation of the conflict
  }>
  confidence?: number // Overall confidence in the consistency assessment
}

/**
 * Service for checking belief consistency within a patient's profile.
 */
export class BeliefConsistencyService {
  /**
   * Checks a new statement or belief for consistency with the patient's profile.
   * This implementation uses targeted pattern matching and is a placeholder for
   * more sophisticated NLP-based approaches.
   * @param profile The patient's profile, containing core beliefs and conversation history.
   * @param newStatement The new statement or belief text to check.
   * @param N The number of recent patient statements from history to consider. Defaults to 10.
   * @returns Promise<ConsistencyResult> An object indicating if the statement is consistent
   *                                   and any contradictions found.
   */
  public async checkBeliefConsistency(
    profile: PatientProfile,
    newStatement: string,
    N: number = 10,
  ): Promise<ConsistencyResult> {
    if (!profile) {
      throw new Error('PatientProfile is required')
    }
    if (!newStatement?.trim()) {
      throw new Error('newStatement cannot be empty')
    }
    if (N < 0) {
      throw new Error('N must be non-negative')
    }

    const contradictionsFound: ConsistencyResult['contradictionsFound'] = []
    const lowerNewStatement = newStatement.toLowerCase()

    // Helper functions for negation pattern matching
    const checkPrefixMatch = (
      s: string,
      prefix: string,
      excludePrefix?: string,
    ): boolean => {
      if (!s.startsWith(prefix)) {
        return false
      }
      if (excludePrefix && s.startsWith(excludePrefix)) {
        return false
      }
      return true
    }

    const checkRemainderMatch = (
      s1: string,
      s2: string,
      prefix1: string,
      prefix2: string,
    ): boolean => {
      const remainder1 = s1.substring(prefix1.length)
      const remainder2 = s2.substring(prefix2.length)
      return remainder1 === remainder2
    }

    const checkNegationPattern = (
      s1: string,
      s2: string,
      prefix1: string,
      prefix2: string,
      excludePrefix?: string,
    ): boolean => {
      // Check s1 -> s2 direction
      if (
        checkPrefixMatch(s1, prefix1) &&
        checkPrefixMatch(s2, prefix2, excludePrefix)
      ) {
        if (checkRemainderMatch(s1, s2, prefix1, prefix2)) {
          return true
        }
      }

      // Check s2 -> s1 direction
      if (
        checkPrefixMatch(s2, prefix1) &&
        checkPrefixMatch(s1, prefix2, excludePrefix)
      ) {
        if (checkRemainderMatch(s2, s1, prefix1, prefix2)) {
          return true
        }
      }

      return false
    }

    const checkNeverVsAm = (s1: string, s2: string): boolean => {
      const neverPrefix = 'i am never '
      const amPrefix = 'i am '
      const alwaysPrefix = 'i am always '

      if (s1.startsWith(neverPrefix) && s2.startsWith(amPrefix)) {
        if (
          !s2.startsWith(alwaysPrefix) &&
          !s2.startsWith(neverPrefix) &&
          s1.substring(neverPrefix.length) === s2.substring(amPrefix.length)
        ) {
          return true
        }
      }
      return false
    }

    const checkDirectNegation = (s1L: string, s2L: string): boolean => {
      // Case: "i do not <something>" vs "i <something>"
      if (
        checkNegationPattern(s1L, s2L, 'i do not ', 'i ', 'i do not ')
      ) {
        return true
      }

      // Case: "i am not <something>" vs "i am <something>"
      if (checkNegationPattern(s1L, s2L, 'i am not ', 'i am ', 'i am not ')) {
        return true
      }

      // Case: "i am never <something>" vs "i am always <something>"
      if (checkNegationPattern(s1L, s2L, 'i am never ', 'i am always ')) {
        return true
      }

      // Case: "i am never <something>" vs "i am <something>" (excluding "always" and "never")
      if (checkNeverVsAm(s1L, s2L) || checkNeverVsAm(s2L, s1L)) {
        return true
      }

      // Fallback for simple "not X" vs "X"
      if (s1L === `not ${s2L}` || s2L === `not ${s1L}`) {
        return true
      }

      return false
    }

    // 1. Check against core beliefs in the profile's cognitive model
    for (const coreBelief of profile.cognitiveModel.coreBeliefs) {
      const lowerCoreBelief = coreBelief.belief.toLowerCase()
      if (checkDirectNegation(lowerNewStatement, lowerCoreBelief)) {
        contradictionsFound.push({
          type: 'belief',
          conflictingText: coreBelief.belief,
          explanation: `New statement appears to directly contradict core belief: "${coreBelief.belief}"`,
        })
      }
    }

    // 2. Check against recent conversation history (patient's statements only)
    const recentPatientStatements = profile.conversationHistory
      .filter((msg) => msg.role === 'patient')
      .slice(-N) // Get the last N patient statements
      .map((msg) => ({
        original: msg.content,
        lower: msg.content.toLowerCase(),
      }))

    for (const stmt of recentPatientStatements) {
      if (checkDirectNegation(lowerNewStatement, stmt.lower)) {
        contradictionsFound.push({
          type: 'statement',
          conflictingText: stmt.original,
          explanation: `New statement appears to directly contradict a recent past statement: "${stmt.original}"`,
        })
      }
    }

    const isConsistent = contradictionsFound.length === 0
    // Confidence is binary for now; a more advanced system would have a nuanced score.
    return {
      isConsistent,
      contradictionsFound,
      confidence: isConsistent ? 1.0 : 0.5, // Placeholder confidence
    }
  }
}
