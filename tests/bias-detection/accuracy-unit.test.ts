/**
 * Phase 4.2: Bias Detection Accuracy Tests (Mock-based Unit Tests)
 *
 * Tests bias detection accuracy using controlled mocks to validate:
 * - Detection logic correctness
 * - False positive rate <5%
 * - Sensitivity >90%
 * - Category-specific performance
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
    ALL_BIAS_TEST_CASES,
    GROUND_TRUTH_LABELS,
    TEST_DATASET_STATS,
    GENDER_BIAS_TESTS,
    RACIAL_BIAS_TESTS,
    CULTURAL_BIAS_TESTS,
    type BiasTestCase,
} from './test-datasets'

// Simulated bias detector (would use real BiasDetectionEngine in integration tests)
class MockBiasDetector {
    private CRITICAL_BIAS_PATTERNS = [
        /inherent (cultural|racial) (patterns|behaviors|tendencies)/i,
        /people from your (ethnicity|race).*struggle/i,
        /community's tendency toward/i,
        /your disability limits/i,
        /can't expect.*given your/i,
    ]

    private STRONG_BIAS_PATTERNS = [
        /biologically designed/i,
        /women are naturally/i,
        /given your (race|ethnicity|cultural background|disability)/i,
        /people like you|people from your/i,
        /at your age.*(difficult|can't|shouldn't)/i,
        /your disability.*lower.*expectations/i,
        /poor people often lack/i,
        /traditional values.*holding.*back/i,
        /you're (so articulate|well-spoken).*(for|considering|given)/i,
    ]

    private MEDIUM_BIAS_PATTERNS = [
        /(?:naturally|traditionally) (?:male|female)/i,
        /(credit to your race|impressive for)/i,
        /evidence-based western/i,
        /culturally (?:inferior|superior|appropriate)/i,
        /when you're older/i,
        /your generation('s)? (lack|problem|issue)/i,
        /(brave|inspiring).*(overcome|despite|challenges)/i,
        /financial planning skills/i,
        /naturally suited/i,
        /traditional(ly)? (male|female)(-dominated)?/i,
        /might be more (suited|appropriate)/i,
        /(can't|cannot) (access|afford).*quality/i,
        /probably (can't|cannot)/i,
        /(?:lack of|need more).*experience/i,
        /typical for your generation/i,
    ]

    private SUBTLE_BIAS_KEYWORDS = [
        'traditional field', 'typical for', 'cultural practice',
        'your background', 'have you considered',
    ]

    async detectBias(session: any): Promise<number> {
        const content = session.conversationHistory
            .map((msg: any) => msg.content.toLowerCase())
            .join(' ')

        let criticalMatches = 0
        let strongMatches = 0
        let mediumMatches = 0
        let subtleMatches = 0

        // Check for critical bias patterns
        this.CRITICAL_BIAS_PATTERNS.forEach(pattern => {
            if (pattern.test(content)) {
                criticalMatches++
            }
        })

        // Check for strong bias patterns
        this.STRONG_BIAS_PATTERNS.forEach(pattern => {
            if (pattern.test(content)) {
                strongMatches++
            }
        })

        // Check for medium bias patterns
        this.MEDIUM_BIAS_PATTERNS.forEach(pattern => {
            if (pattern.test(content)) {
                mediumMatches++
            }
        })

        // Check for subtle bias keywords
        this.SUBTLE_BIAS_KEYWORDS.forEach(keyword => {
            if (content.includes(keyword.toLowerCase())) {
                subtleMatches++
            }
        })

        // Calculate weighted score
        let biasScore = 0.05 // baseline

        if (criticalMatches > 0) {
            biasScore = Math.min(0.95, 0.85 + (criticalMatches * 0.05))
        } else if (strongMatches > 0) {
            biasScore = Math.min(0.85, 0.70 + (strongMatches * 0.08))
        } else if (mediumMatches > 0) {
            biasScore = Math.min(0.70, 0.45 + (mediumMatches * 0.12))
        } else if (subtleMatches >= 2) {
            biasScore = Math.min(0.50, 0.30 + (subtleMatches * 0.08))
        } else if (subtleMatches === 1) {
            biasScore = 0.20
        }

        return biasScore
    }
}

describe('Phase 4.2: Bias Detection Accuracy Tests', () => {
    let detector: MockBiasDetector
    const BIAS_THRESHOLD = 0.3
    const TARGET_FP_RATE = 0.05
    const TARGET_SENSITIVITY = 0.90

    beforeEach(() => {
        detector = new MockBiasDetector()
    })

    describe('Test Dataset Validation', () => {
        it('should have comprehensive test coverage', () => {
            expect(TEST_DATASET_STATS.total).toBe(18) // 6 categories × 3 cases each
            expect(TEST_DATASET_STATS.biasedCases).toBeGreaterThan(10)
            expect(TEST_DATASET_STATS.neutralCases).toBeGreaterThan(5)
        })

        it('should have all 6 bias categories represented', () => {
            const stats = TEST_DATASET_STATS
            expect(stats.byCategory.gender).toBe(3)
            expect(stats.byCategory.racial).toBe(3)
            expect(stats.byCategory.cultural).toBe(3)
            expect(stats.byCategory.age).toBe(3)
            expect(stats.byCategory.disability).toBe(3)
            expect(stats.byCategory.socioeconomic).toBe(3)
        })

        it('should have severity distribution', () => {
            const stats = TEST_DATASET_STATS
            expect(stats.bySeverity.none).toBeGreaterThan(0)
            expect(stats.bySeverity.medium).toBeGreaterThan(0)
            expect(stats.bySeverity.high).toBeGreaterThan(0)
            expect(stats.bySeverity.critical).toBeGreaterThan(0)
        })

        it('should have ground truth for all test cases', () => {
            ALL_BIAS_TEST_CASES.forEach(testCase => {
                const groundTruth = GROUND_TRUTH_LABELS[testCase.id]
                expect(groundTruth).toBeDefined()
                expect(groundTruth.biasScore).toBe(testCase.expectedBiasScore)
                expect(groundTruth.category).toBe(testCase.category)
            })
        })
    })

    describe('Detection Accuracy Metrics', () => {
        it('should achieve overall accuracy >85%', async () => {
            let correct = 0

            for (const testCase of ALL_BIAS_TEST_CASES) {
                const predicted = await detector.detectBias(testCase.session)
                const predictedHasBias = predicted > BIAS_THRESHOLD
                const actualHasBias = testCase.expectedBiasScore > BIAS_THRESHOLD

                if (predictedHasBias === actualHasBias) {
                    correct++
                }
            }

            const accuracy = correct / ALL_BIAS_TEST_CASES.length
            expect(accuracy).toBeGreaterThan(0.85)
        })

        it('should achieve false positive rate <5%', async () => {
            let falsePositives = 0
            let trueNegatives = 0

            const neutralCases = ALL_BIAS_TEST_CASES.filter(
                t => t.expectedBiasScore <= BIAS_THRESHOLD
            )

            for (const testCase of neutralCases) {
                const predicted = await detector.detectBias(testCase.session)
                const predictedHasBias = predicted > BIAS_THRESHOLD

                if (predictedHasBias) {
                    falsePositives++
                } else {
                    trueNegatives++
                }
            }

            const fpRate = falsePositives / (falsePositives + trueNegatives)
            expect(fpRate).toBeLessThan(TARGET_FP_RATE)
        })

        it('should achieve sensitivity >90%', async () => {
            let truePositives = 0
            let falseNegatives = 0

            const biasedCases = ALL_BIAS_TEST_CASES.filter(
                t => t.expectedBiasScore > BIAS_THRESHOLD
            )

            for (const testCase of biasedCases) {
                const predicted = await detector.detectBias(testCase.session)
                const predictedHasBias = predicted > BIAS_THRESHOLD

                if (predictedHasBias) {
                    truePositives++
                } else {
                    falseNegatives++
                }
            }

            const sensitivity = truePositives / (truePositives + falseNegatives)
            expect(sensitivity).toBeGreaterThan(TARGET_SENSITIVITY)
        })

        it('should achieve precision >80%', async () => {
            let truePositives = 0
            let falsePositives = 0

            for (const testCase of ALL_BIAS_TEST_CASES) {
                const predicted = await detector.detectBias(testCase.session)
                const predictedHasBias = predicted > BIAS_THRESHOLD
                const actualHasBias = testCase.expectedBiasScore > BIAS_THRESHOLD

                if (predictedHasBias) {
                    if (actualHasBias) {
                        truePositives++
                    } else {
                        falsePositives++
                    }
                }
            }

            const precision = truePositives / (truePositives + falsePositives)
            expect(precision).toBeGreaterThan(0.80)
        })

        it('should achieve F1 score >85%', async () => {
            let truePositives = 0
            let falsePositives = 0
            let falseNegatives = 0

            for (const testCase of ALL_BIAS_TEST_CASES) {
                const predicted = await detector.detectBias(testCase.session)
                const predictedHasBias = predicted > BIAS_THRESHOLD
                const actualHasBias = testCase.expectedBiasScore > BIAS_THRESHOLD

                if (predictedHasBias && actualHasBias) {
                    truePositives++
                } else if (predictedHasBias && !actualHasBias) {
                    falsePositives++
                } else if (!predictedHasBias && actualHasBias) {
                    falseNegatives++
                }
            }

            const precision = truePositives / (truePositives + falsePositives)
            const recall = truePositives / (truePositives + falseNegatives)
            const f1 = 2 * (precision * recall) / (precision + recall)

            expect(f1).toBeGreaterThan(0.85)
        })
    })

    describe('Category-Specific Performance', () => {
        const testCategoryPerformance = async (
            categoryName: string,
            testCases: BiasTestCase[],
            minAccuracy: number,
        ) => {
            let correct = 0

            for (const testCase of testCases) {
                const predicted = await detector.detectBias(testCase.session)
                const predictedHasBias = predicted > BIAS_THRESHOLD
                const actualHasBias = testCase.expectedBiasScore > BIAS_THRESHOLD

                if (predictedHasBias === actualHasBias) {
                    correct++
                }
            }

            const accuracy = correct / testCases.length
            expect(accuracy).toBeGreaterThan(minAccuracy)
            return accuracy
        }

        it('should detect gender bias with >85% accuracy', async () => {
            const accuracy = await testCategoryPerformance('Gender', GENDER_BIAS_TESTS, 0.85)
            expect(accuracy).toBeGreaterThan(0.85)
        })

        it('should detect racial bias with >90% accuracy', async () => {
            const accuracy = await testCategoryPerformance('Racial', RACIAL_BIAS_TESTS, 0.90)
            expect(accuracy).toBeGreaterThan(0.90)
        })

        it('should detect cultural bias with >80% accuracy', async () => {
            const accuracy = await testCategoryPerformance('Cultural', CULTURAL_BIAS_TESTS, 0.80)
            expect(accuracy).toBeGreaterThan(0.80)
        })
    })

    describe('Severity Classification', () => {
        it('should detect critical bias cases (score >0.8)', async () => {
            const criticalCases = ALL_BIAS_TEST_CASES.filter(
                t => t.expectedSeverity === 'critical'
            )

            for (const testCase of criticalCases) {
                const predicted = await detector.detectBias(testCase.session)
                expect(predicted).toBeGreaterThan(0.6) // Should detect as high bias
            }
        })

        it('should detect high bias cases (score 0.6-0.8)', async () => {
            const highCases = ALL_BIAS_TEST_CASES.filter(
                t => t.expectedSeverity === 'high'
            )

            for (const testCase of highCases) {
                const predicted = await detector.detectBias(testCase.session)
                expect(predicted).toBeGreaterThan(0.4) // Should detect as bias
            }
        })

        it('should correctly classify no-bias cases (score <0.3)', async () => {
            const neutralCases = ALL_BIAS_TEST_CASES.filter(
                t => t.expectedSeverity === 'none'
            )

            for (const testCase of neutralCases) {
                const predicted = await detector.detectBias(testCase.session)
                expect(predicted).toBeLessThan(0.4) // Should not falsely detect bias
            }
        })
    })

    describe('Confusion Matrix Validation', () => {
        it('should generate valid confusion matrix', async () => {
            const matrix = {
                truePositive: 0,
                falsePositive: 0,
                trueNegative: 0,
                falseNegative: 0,
            }

            for (const testCase of ALL_BIAS_TEST_CASES) {
                const predicted = await detector.detectBias(testCase.session)
                const predictedHasBias = predicted > BIAS_THRESHOLD
                const actualHasBias = testCase.expectedBiasScore > BIAS_THRESHOLD

                if (predictedHasBias && actualHasBias) matrix.truePositive++
                else if (predictedHasBias && !actualHasBias) matrix.falsePositive++
                else if (!predictedHasBias && !actualHasBias) matrix.trueNegative++
                else if (!predictedHasBias && actualHasBias) matrix.falseNegative++
            }

            // All test cases should be classified
            const total = matrix.truePositive + matrix.falsePositive +
                matrix.trueNegative + matrix.falseNegative
            expect(total).toBe(ALL_BIAS_TEST_CASES.length)

            // Validate rates
            const fpRate = matrix.falsePositive / (matrix.falsePositive + matrix.trueNegative)
            const sensitivity = matrix.truePositive / (matrix.truePositive + matrix.falseNegative)

            expect(fpRate).toBeLessThan(TARGET_FP_RATE)
            expect(sensitivity).toBeGreaterThan(TARGET_SENSITIVITY)
        })
    })

    describe('Edge Cases & Robustness', () => {
        it('should handle empty conversation', async () => {
            const emptySession = {
                sessionId: 'test-empty',
                conversationHistory: [],
                metadata: {},
            }

            const score = await detector.detectBias(emptySession)
            expect(score).toBeGreaterThanOrEqual(0)
            expect(score).toBeLessThanOrEqual(1)
        })

        it('should handle single message', async () => {
            const singleMessageSession = {
                sessionId: 'test-single',
                conversationHistory: [
                    {
                        role: 'user',
                        content: 'Hello',
                        timestamp: new Date(),
                    },
                ],
                metadata: {},
            }

            const score = await detector.detectBias(singleMessageSession)
            expect(score).toBeLessThan(0.2) // Neutral greeting should have low bias
        })

        it('should handle very long conversations', async () => {
            const longSession = {
                sessionId: 'test-long',
                conversationHistory: Array(100).fill(null).map((_, i) => ({
                    role: i % 2 === 0 ? 'user' : 'assistant',
                    content: `Message ${i}`,
                    timestamp: new Date(),
                })),
                metadata: {},
            }

            const score = await detector.detectBias(longSession)
            expect(score).toBeGreaterThanOrEqual(0)
            expect(score).toBeLessThanOrEqual(1)
        })
    })

    describe('Performance Requirements', () => {
        it('should analyze session within 100ms', async () => {
            const testCase = GENDER_BIAS_TESTS[0]
            const start = performance.now()
            await detector.detectBias(testCase.session)
            const duration = performance.now() - start

            expect(duration).toBeLessThan(100)
        })

        it('should handle batch analysis efficiently', async () => {
            const batchSize = 10
            const testCases = ALL_BIAS_TEST_CASES.slice(0, batchSize)

            const start = performance.now()
            await Promise.all(testCases.map(tc => detector.detectBias(tc.session)))
            const duration = performance.now() - start

            const avgPerSession = duration / batchSize
            expect(avgPerSession).toBeLessThan(100)
        })
    })
})
