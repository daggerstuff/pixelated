import type {
  BehavioralPattern,
  BehavioralSequence,
  PatternMiner,
} from '../behavioral-analysis-service'

interface FrequentPattern {
  pattern: string[]
  support: number
  confidence: number
  frequency: number
  type: string
}

export class SequentialPatternMiner implements PatternMiner {
  private minSupport = 0.1
  private maxPatternLength = 10
  private minPatternLength = 2
  private maxInputSequences = 5000
  private maxRecursionDepth = 8
  private maxCandidatesPerIteration = 5000
  private spadeSequenceLimit = 1000
  private spadeAverageLengthLimit = 15

  async minePatterns(
    sequences: BehavioralSequence[],
  ): Promise<BehavioralPattern[]> {
    try {
      const processedSequences = this.preprocessSequences(sequences)

      const frequentPatterns =
        await this.mineFrequentPatterns(processedSequences)

      const significantPatterns =
        this.filterSignificantPatterns(frequentPatterns)

      return await this.calculatePatternStatistics(
        significantPatterns,
        processedSequences,
      )
    } catch (error) {
      console.error('Error in sequential pattern mining:', error)
      return []
    }
  }

  private preprocessSequences(sequences: BehavioralSequence[]): string[][] {
    return sequences
      .filter((seq) => seq.actions.length >= this.minPatternLength)
      .map((seq) =>
        seq.actions.filter((action) => action && action.trim().length > 0),
      )
  }

  private async mineFrequentPatterns(
    sequences: string[][],
  ): Promise<FrequentPattern[]> {
    if (sequences.length === 0) {
      return []
    }

    const boundedSequences = sequences.slice(0, this.maxInputSequences)
    const averageLength =
      boundedSequences.reduce((sum, sequence) => sum + sequence.length, 0) /
      boundedSequences.length

    const shouldUseSpade =
      boundedSequences.length <= this.spadeSequenceLimit &&
      averageLength <= this.spadeAverageLengthLimit

    if (shouldUseSpade) {
      return this.spade(boundedSequences, this.minSupport)
    }

    return this.prefixSpan(boundedSequences, this.minSupport)
  }

  private async prefixSpan(
    sequences: string[][],
    minSupport: number,
  ): Promise<FrequentPattern[]> {
    const patterns: FrequentPattern[] = []
    const frequentItems = this.findFrequentItems(sequences, minSupport)

    for (const item of frequentItems) {
      const projectedDB = this.projectDatabase(sequences, [item])
      const pattern = await this.prefixSpanGrowth(
        projectedDB,
        [item],
        minSupport,
        1,
      )
      patterns.push(...pattern)
    }

    return patterns
  }

  private async prefixSpanGrowth(
    projectedDB: string[][],
    prefix: string[],
    minSupport: number,
    depth: number,
  ): Promise<FrequentPattern[]> {
    const patterns: FrequentPattern[] = []

    if (
      prefix.length >= this.maxPatternLength ||
      depth >= this.maxRecursionDepth
    ) {
      return patterns
    }

    const frequentItems = this.findFrequentItems(projectedDB, minSupport)

    for (const item of frequentItems) {
      const newPrefix = [...prefix, item]
      const support = this.calculateSupport(projectedDB, newPrefix)

      if (support >= minSupport) {
        patterns.push({
          pattern: newPrefix,
          support,
          confidence: support,
          frequency: support,
          type: 'sequential',
        })

        const newProjectedDB = this.projectDatabase(projectedDB, newPrefix)
        const subPatterns = await this.prefixSpanGrowth(
          newProjectedDB,
          newPrefix,
          minSupport,
          depth + 1,
        )
        patterns.push(...subPatterns)
      }
    }

    return patterns
  }

  private async spade(
    sequences: string[][],
    minSupport: number,
  ): Promise<FrequentPattern[]> {
    const patterns: FrequentPattern[] = []

    const idLists = this.buildIdLists(sequences)
    const frequentSequences = this.enumerateFrequentSequences(
      idLists,
      minSupport,
      sequences.length,
    )

    for (const seq of frequentSequences) {
      const support = this.calculateSequenceSupport(seq, sequences)
      if (support >= minSupport) {
        patterns.push({
          pattern: seq,
          support,
          confidence: support,
          frequency: support,
          type: 'sequential',
        })
      }
    }

    return patterns
  }

  private findFrequentItems(
    sequences: string[][],
    minSupport: number,
  ): string[] {
    const itemCounts: Record<string, number> = {}

    for (const sequence of sequences) {
      const uniqueItems = Array.from(new Set(sequence))
      for (const item of uniqueItems) {
        itemCounts[item] = (itemCounts[item] || 0) + 1
      }
    }

    const totalSequences = sequences.length
    const minCount = Math.ceil(totalSequences * minSupport)

    return Object.entries(itemCounts)
      .filter(([_, count]) => count >= minCount)
      .map(([item]) => item)
  }

  private projectDatabase(sequences: string[][], prefix: string[]): string[][] {
    const projectedDB: string[][] = []

    for (const sequence of sequences) {
      const projectedSequence: string[] = []

      for (let i = 0; i < sequence.length; i++) {
        if (sequence[i] === prefix[prefix.length - 1]) {
          const remainingSequence = sequence.slice(i + 1)
          if (remainingSequence.length > 0) {
            projectedSequence.push(...remainingSequence)
          }
          break
        }
      }

      if (projectedSequence.length > 0) {
        projectedDB.push(projectedSequence)
      }
    }

    return projectedDB
  }

  private buildIdLists(sequences: string[][]): Record<string, number[][]> {
    const idLists: Record<string, number[][]> = {}

    sequences.forEach((sequence, seqIndex) => {
      sequence.forEach((item, itemIndex) => {
        if (!idLists[item]) {
          idLists[item] = []
        }
        idLists[item].push([seqIndex, itemIndex])
      })
    })

    return idLists
  }

  private enumerateFrequentSequences(
    idLists: Record<string, number[][]>,
    minSupport: number,
    totalSequences: number,
  ): string[][] {
    const frequentSequences: string[][] = []
    const minCount = Math.ceil(totalSequences * minSupport)

    for (const item of Object.keys(idLists)) {
      const uniqueSequenceIds = new Set(idLists[item].map((entry) => entry[0]))
      if (uniqueSequenceIds.size >= minCount) {
        frequentSequences.push([item])
      }
    }

    let k = 2
    while (k <= this.maxPatternLength) {
      const candidates = this.generateCandidates(frequentSequences, k)
      const frequentKSequences: string[][] = []

      for (const candidate of candidates) {
        if (
          this.isFrequentSequence(
            candidate,
            idLists,
            minSupport,
            totalSequences,
          )
        ) {
          frequentKSequences.push(candidate)
        }
      }

      if (frequentKSequences.length === 0) {
        break
      }

      frequentSequences.push(...frequentKSequences)
      k++
    }

    return frequentSequences
  }

  private generateCandidates(
    frequentSequences: string[][],
    k: number,
  ): string[][] {
    const candidates: string[][] = []
    const candidateSet = new Set<string>()

    for (let i = 0; i < frequentSequences.length; i++) {
      for (let j = i + 1; j < frequentSequences.length; j++) {
        const seq1 = frequentSequences[i]
        const seq2 = frequentSequences[j]

        if (
          seq1.length === k - 1 &&
          seq2.length === k - 1 &&
          seq1.slice(0, -1).every((item, idx) => item === seq2[idx])
        ) {
          const candidate = [...seq1, seq2[seq2.length - 1]]
          const key = candidate.join('\u0001')
          if (!candidateSet.has(key)) {
            candidateSet.add(key)
            candidates.push(candidate)
            if (candidates.length >= this.maxCandidatesPerIteration) {
              return candidates
            }
          }
        }
      }
    }

    return candidates
  }

  private isFrequentSequence(
    sequence: string[],
    idLists: Record<string, number[][]>,
    minSupport: number,
    totalSequences: number,
  ): boolean {
    const minCount = Math.ceil(totalSequences * minSupport)

    const positionMaps = new Map<string, Map<number, number[]>>()
    for (const item of sequence) {
      const idList = idLists[item]
      if (!idList) {
        return false
      }
      const map = this.buildSequencePositionMap(idList)
      positionMaps.set(item, map)
    }

    const candidateSequenceIds = this.intersectSequenceIds(positionMaps)
    if (candidateSequenceIds.length < minCount) {
      return false
    }

    let supportCount = 0
    for (const sequenceId of candidateSequenceIds) {
      if (this.hasOrderedOccurrence(sequence, sequenceId, positionMaps)) {
        supportCount++
        if (supportCount >= minCount) {
          return true
        }
      }
    }

    return false
  }

  private buildSequencePositionMap(idList: number[][]): Map<number, number[]> {
    const map = new Map<number, number[]>()
    for (const [sequenceId, itemIndex] of idList) {
      const positions = map.get(sequenceId)
      if (positions) {
        positions.push(itemIndex)
      } else {
        map.set(sequenceId, [itemIndex])
      }
    }

    for (const positions of map.values()) {
      positions.sort((a, b) => a - b)
    }

    return map
  }

  private intersectSequenceIds(
    positionMaps: Map<string, Map<number, number[]>>,
  ): number[] {
    const maps = [...positionMaps.values()]
    if (maps.length === 0) {
      return []
    }

    const [firstMap, ...rest] = maps
    const sequenceIds: number[] = []

    for (const sequenceId of firstMap.keys()) {
      if (rest.every((map) => map.has(sequenceId))) {
        sequenceIds.push(sequenceId)
      }
    }

    return sequenceIds
  }

  private hasOrderedOccurrence(
    sequence: string[],
    sequenceId: number,
    positionMaps: Map<string, Map<number, number[]>>,
  ): boolean {
    let previousIndex = -1

    for (const item of sequence) {
      const positions = positionMaps.get(item)?.get(sequenceId)
      if (!positions) {
        return false
      }

      const nextIndex = positions.find((position) => position > previousIndex)
      if (nextIndex === undefined) {
        return false
      }

      previousIndex = nextIndex
    }

    return true
  }

  private calculateSequenceSupport(
    sequence: string[],
    sequences: string[][],
  ): number {
    let count = 0

    for (const seq of sequences) {
      if (this.containsSequence(seq, sequence)) {
        count++
      }
    }

    return count
  }

  private containsSequence(sequence: string[], pattern: string[]): boolean {
    if (pattern.length === 0) {
      return true
    }
    if (pattern.length > sequence.length) {
      return false
    }

    for (let i = 0; i <= sequence.length - pattern.length; i++) {
      let match = true
      for (let j = 0; j < pattern.length; j++) {
        if (sequence[i + j] !== pattern[j]) {
          match = false
          break
        }
      }
      if (match) {
        return true
      }
    }

    return false
  }

  private calculateSupport(sequences: string[][], pattern: string[]): number {
    let count = 0
    for (const sequence of sequences) {
      if (this.containsSequence(sequence, pattern)) {
        count++
      }
    }
    return count
  }

  private filterSignificantPatterns(
    patterns: FrequentPattern[],
  ): FrequentPattern[] {
    return patterns.filter(
      (pattern) =>
        pattern.pattern.length >= this.minPatternLength &&
        pattern.support >= this.minSupport &&
        pattern.confidence > 0.5,
    )
  }

  private async calculatePatternStatistics(
    patterns: FrequentPattern[],
    sequences: string[][],
  ): Promise<BehavioralPattern[]> {
    const behavioralPatterns: BehavioralPattern[] = []

    for (const freqPattern of patterns) {
      const stability = await this.calculatePatternStability(
        freqPattern,
        sequences,
      )
      const { confidence } = freqPattern
      const frequency = freqPattern.support

      behavioralPatterns.push({
        patternId: this.generatePatternId(freqPattern.pattern),
        patternType: 'sequential',
        patternData: {
          sequence: freqPattern.pattern,
          support: freqPattern.support,
          type: 'sequential',
        },
        confidence,
        frequency,
        lastObserved: new Date(),
        stability,
      })
    }

    return behavioralPatterns
  }

  private async calculatePatternStability(
    pattern: FrequentPattern,
    sequences: string[][],
  ): Promise<number> {
    let totalOccurrences = 0
    let consistentOccurrences = 0

    for (const sequence of sequences) {
      const occurrences = this.countPatternOccurrences(
        sequence,
        pattern.pattern,
      )
      totalOccurrences += occurrences

      if (occurrences > 0) {
        consistentOccurrences++
      }
    }

    if (totalOccurrences === 0) {
      return 0
    }

    return consistentOccurrences / sequences.length
  }

  private countPatternOccurrences(
    sequence: string[],
    pattern: string[],
  ): number {
    if (pattern.length === 0) {
      return 0
    }
    if (pattern.length > sequence.length) {
      return 0
    }

    let count = 0
    for (let i = 0; i <= sequence.length - pattern.length; i++) {
      let match = true
      for (let j = 0; j < pattern.length; j++) {
        if (sequence[i + j] !== pattern[j]) {
          match = false
          break
        }
      }
      if (match) {
        count++
        i += pattern.length - 1
      }
    }

    return count
  }

  private generatePatternId(pattern: string[]): string {
    return `pattern_${pattern.join('_')}_${Date.now()}`
  }
}
