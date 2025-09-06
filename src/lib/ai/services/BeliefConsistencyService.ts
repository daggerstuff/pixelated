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

    // Helper function for more targeted negation checking
    const checkDirectNegation = (s1L: string, s2L: string): boolean => {
      // Case: "i do not <something>" vs "i <something>"
      // Example: s1L="i do not hate pizza", s2L="i hate pizza"
      if (
        s1L.startsWith('i do not ') &&
        s2L.startsWith('i ') &&
        !s2L.startsWith('i do not ') &&
        s1L.substring(9) === s2L.substring(2)
      ) {
        return true
      }
      if (
        s2L.startsWith('i do not ') &&
        s1L.startsWith('i ') &&
        !s1L.startsWith('i do not ') &&
        s2L.substring(9) === s1L.substring(2)
      ) {
        return true
      }

      // Case: "i am not <something>" vs "i am <something>"
      // Example: s1L="i am not worthless", s2L="i am worthless"
      if (
        s1L.startsWith('i am not ') &&
        s2L.startsWith('i am ') &&
        !s2L.startsWith('i am not ') &&
        s1L.substring(9) === s2L.substring(5)
      ) {
        return true
      }
      if (
        s2L.startsWith('i am not ') &&
        s1L.startsWith('i am ') &&
        !s1L.startsWith('i am not ') &&
        s2L.substring(9) === s1L.substring(5)
      ) {
        return true
      }

      // Case: "i am never <something>" vs "i am always <something>"
      // Example: s1L="i am never failing", s2L="i am always failing"
      if (
        s1L.startsWith('i am never ') &&
        s2L.startsWith('i am always ') &&
        s1L.substring(11) === s2L.substring(12)
      ) {
        return true
      }
      if (
        s2L.startsWith('i am never ') &&
        s1L.startsWith('i am always ') &&
        s2L.substring(11) === s1L.substring(12)
      ) {
        return true
      }

      // Case: "i am never <something>" vs "i am <something>" (where <something> is not "always <...>")
      // Example: s1L="i am never happy", s2L="i am happy"
      if (
        s1L.startsWith('i am never ') &&
        s2L.startsWith('i am ') &&
        !s2L.startsWith('i am always ') &&
        !s2L.startsWith('i am never ') &&
        s1L.substring(11) === s2L.substring(5)
      ) {
        return true
      }
      if (
        s2L.startsWith('i am never ') &&
        s1L.startsWith('i am ') &&
        !s1L.startsWith('i am always ') &&
        !s1L.startsWith('i am never ') &&
        s2L.substring(11) === s1L.substring(5)
      ) {
        return true
      }

      // Fallback for simple "not X" vs "X" if not caught by specific "i am not" etc.
      // Example: s1L = "not good", s2L = "good"
      if (s1L === `not ${s2L}`) {
        return true
      }
      if (s2L === `not ${s1L}`) {
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
