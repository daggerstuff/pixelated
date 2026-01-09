/**
 * Phase 4.2: Bias Detection Accuracy Tests
 *
 * Tests the BiasDetectionEngine against labeled test datasets to measure:
 * - Detection accuracy (true positives + true negatives)
 * - False positive rate (target: <5%)
 * - Sensitivity/recall (target: >90% for detecting actual bias)
 * - Category-specific performance (gender, racial, cultural, age, disability, socioeconomic)
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'
import { BiasDetectionEngine } from '../../src/lib/ai/bias-detection/BiasDetectionEngine'
import {
    ALL_BIAS_TEST_CASES,
    GROUND_TRUTH_LABELS,
    TEST_DATASET_STATS,
    GENDER_BIAS_TESTS,
    RACIAL_BIAS_TESTS,
    CULTURAL_BIAS_TESTS,
    AGE_BIAS_TESTS,
    DISABILITY_BIAS_TESTS,
    SOCIOECONOMIC_BIAS_TESTS,
    type BiasTestCase,
} from './test-datasets'

// Mock Python service for controlled testing
vi.mock('../../src/lib/ai/bias-detection/python-bridge')

describe('Phase 4.2: Bias Detection Accuracy Tests', () => {
    let engine: BiasDetectionEngine
    const BIAS_THRESHOLD = 0.3 // Scores above this indicate bias
    const TARGET_FP_RATE = 0.05 // <5% false positives
    const TARGET_SENSITIVITY = 0.90 // >90% true positive rate

    beforeAll(async () => {
        engine = new BiasDetectionEngine({
            thresholds: {
                warning: 0.3,
                high: 0.6,
                critical: 0.8,
            },
        })
        await engine.initialize()
    })

    describe('Test Dataset Validation', () => {
        it('should have balanced test dataset', () => {
            const stats = TEST_DATASET_STATS

            expect(stats.total).toBeGreaterThan(0)
            expect(stats.biasedCases).toBeGreaterThan(0)
            expect(stats.neutralCases).toBeGreaterThan(0)

            // Each category should have at least 3 test cases (high/medium/none)
            Object.values(stats.byCategory).forEach(count => {
                expect(count).toBeGreaterThanOrEqual(3)
            })
        })

        it('should have ground truth labels for all test cases', () => {
            ALL_BIAS_TEST_CASES.forEach(testCase => {
                expect(GROUND_TRUTH_LABELS[testCase.id]).toBeDefined()
                expect(GROUND_TRUTH_LABELS[testCase.id].biasScore).toBe(testCase.expectedBiasScore)
            })
        })

        it('should have realistic bias score distribution', () => {
            const biasScores = ALL_BIAS_TEST_CASES.map(t => t.expectedBiasScore)

            // Should have scores across the full range
            expect(Math.min(...biasScores)).toBeLessThan(0.2)
            expect(Math.max(...biasScores)).toBeGreaterThan(0.7)

            // Should have variety in severity levels
            const severities = new Set(ALL_BIAS_TEST_CASES.map(t => t.expectedSeverity))
            expect(severities.size).toBeGreaterThanOrEqual(4)
        })
    })

    describe('Detection Accuracy Metrics', () => {
        let results: Map<string, { predicted: number; actual: number; category: string }>

        beforeAll(async () => {
            results = new Map()

            // Run bias detection on all test cases
            for (const testCase of ALL_BIAS_TEST_CASES) {
                try {
                    const analysis = await engine.analyzeSession(testCase.session)
                    results.set(testCase.id, {
                        predicted: analysis.overallBiasScore,
                        actual: testCase.expectedBiasScore,
                        category: testCase.category,
                    })
                } catch (error) {
                    console.warn(`Failed to analyze test case ${testCase.id}:`, error)
                }
            }
        })

        it('should achieve overall accuracy >85%', () => {
            let correct = 0
            let total = 0

            results.forEach((result, id) => {
                const groundTruth = GROUND_TRUTH_LABELS[id]
                const predictedHasBias = result.predicted > BIAS_THRESHOLD
                const actualHasBias = groundTruth.hasBias

                if (predictedHasBias === actualHasBias) {
                    correct++
                }
                total++
            })

            const accuracy = correct / total
            expect(accuracy).toBeGreaterThan(0.85)
            console.log(`Overall Accuracy: ${(accuracy * 100).toFixed(2)}%`)
        })

        it('should achieve false positive rate <5%', () => {
            let falsePositives = 0
            let trueNegatives = 0

            results.forEach((result, id) => {
                const groundTruth = GROUND_TRUTH_LABELS[id]
                const predictedHasBias = result.predicted > BIAS_THRESHOLD
                const actualHasBias = groundTruth.hasBias

                if (!actualHasBias) {
                    if (predictedHasBias) {
                        falsePositives++
                    } else {
                        trueNegatives++
                    }
                }
            })

            const fpRate = falsePositives / (falsePositives + trueNegatives)
            expect(fpRate).toBeLessThan(TARGET_FP_RATE)
            console.log(`False Positive Rate: ${(fpRate * 100).toFixed(2)}%`)
        })

        it('should achieve sensitivity >90% for detecting bias', () => {
            let truePositives = 0
            let falseNegatives = 0

            results.forEach((result, id) => {
                const groundTruth = GROUND_TRUTH_LABELS[id]
                const predictedHasBias = result.predicted > BIAS_THRESHOLD
                const actualHasBias = groundTruth.hasBias

                if (actualHasBias) {
                    if (predictedHasBias) {
                        truePositives++
                    } else {
                        falseNegatives++
                    }
                }
            })

            const sensitivity = truePositives / (truePositives + falseNegatives)
            expect(sensitivity).toBeGreaterThan(TARGET_SENSITIVITY)
            console.log(`Sensitivity (Recall): ${(sensitivity * 100).toFixed(2)}%`)
        })

        it('should achieve precision >80%', () => {
            let truePositives = 0
            let falsePositives = 0

            results.forEach((result, id) => {
                const groundTruth = GROUND_TRUTH_LABELS[id]
                const predictedHasBias = result.predicted > BIAS_THRESHOLD
                const actualHasBias = groundTruth.hasBias

                if (predictedHasBias) {
                    if (actualHasBias) {
                        truePositives++
                    } else {
                        falsePositives++
                    }
                }
            })

            const precision = truePositives / (truePositives + falsePositives)
            expect(precision).toBeGreaterThan(0.80)
            console.log(`Precision: ${(precision * 100).toFixed(2)}%`)
        })

        it('should achieve F1 score >85%', () => {
            let truePositives = 0
            let falsePositives = 0
            let falseNegatives = 0

            results.forEach((result, id) => {
                const groundTruth = GROUND_TRUTH_LABELS[id]
                const predictedHasBias = result.predicted > BIAS_THRESHOLD
                const actualHasBias = groundTruth.hasBias

                if (predictedHasBias && actualHasBias) {
                    truePositives++
                } else if (predictedHasBias && !actualHasBias) {
                    falsePositives++
                } else if (!predictedHasBias && actualHasBias) {
                    falseNegatives++
                }
            })

            const precision = truePositives / (truePositives + falsePositives)
            const recall = truePositives / (truePositives + falseNegatives)
            const f1 = 2 * (precision * recall) / (precision + recall)

            expect(f1).toBeGreaterThan(0.85)
            console.log(`F1 Score: ${(f1 * 100).toFixed(2)}%`)
        })
    })

    describe('Category-Specific Performance', () => {
        const testCategoryPerformance = async (
            category: string,
            testCases: BiasTestCase[],
            minAccuracy: number,
        ) => {
            let correct = 0
            let total = 0

            for (const testCase of testCases) {
                const analysis = await engine.analyzeSession(testCase.session)
                const predictedHasBias = analysis.overallBiasScore > BIAS_THRESHOLD
                const actualHasBias = testCase.expectedBiasScore > BIAS_THRESHOLD

                if (predictedHasBias === actualHasBias) {
                    correct++
                }
                total++
            }

            const accuracy = correct / total
            expect(accuracy).toBeGreaterThan(minAccuracy)
            console.log(`${category} Accuracy: ${(accuracy * 100).toFixed(2)}%`)
            return accuracy
        }

        it('should detect gender bias with >85% accuracy', async () => {
            await testCategoryPerformance('Gender', GENDER_BIAS_TESTS, 0.85)
        })

        it('should detect racial bias with >90% accuracy', async () => {
            await testCategoryPerformance('Racial', RACIAL_BIAS_TESTS, 0.90)
        })

        it('should detect cultural bias with >80% accuracy', async () => {
            await testCategoryPerformance('Cultural', CULTURAL_BIAS_TESTS, 0.80)
        })

        it('should detect age bias with >85% accuracy', async () => {
            await testCategoryPerformance('Age', AGE_BIAS_TESTS, 0.85)
        })

        it('should detect disability bias with >85% accuracy', async () => {
            await testCategoryPerformance('Disability', DISABILITY_BIAS_TESTS, 0.85)
        })

        it('should detect socioeconomic bias with >80% accuracy', async () => {
            await testCategoryPerformance('Socioeconomic', SOCIOECONOMIC_BIAS_TESTS, 0.80)
        })
    })

    describe('Severity Classification Accuracy', () => {
        it('should correctly classify critical bias (>0.8)', async () => {
            const criticalCases = ALL_BIAS_TEST_CASES.filter(t => t.expectedSeverity === 'critical')
            let correctClassifications = 0

            for (const testCase of criticalCases) {
                const analysis = await engine.analyzeSession(testCase.session)
                if (analysis.overallBiasScore > 0.8) {
                    correctClassifications++
                }
            }

            const accuracy = correctClassifications / criticalCases.length
            expect(accuracy).toBeGreaterThan(0.80)
        })

        it('should correctly classify high bias (0.6-0.8)', async () => {
            const highCases = ALL_BIAS_TEST_CASES.filter(t => t.expectedSeverity === 'high')
            let correctClassifications = 0

            for (const testCase of highCases) {
                const analysis = await engine.analyzeSession(testCase.session)
                if (analysis.overallBiasScore >= 0.6 && analysis.overallBiasScore < 0.9) {
                    correctClassifications++
                }
            }

            const accuracy = correctClassifications / highCases.length
            expect(accuracy).toBeGreaterThan(0.70)
        })

        it('should correctly classify medium bias (0.4-0.6)', async () => {
            const mediumCases = ALL_BIAS_TEST_CASES.filter(t => t.expectedSeverity === 'medium')
            let correctClassifications = 0

            for (const testCase of mediumCases) {
                const analysis = await engine.analyzeSession(testCase.session)
                if (analysis.overallBiasScore >= 0.4 && analysis.overallBiasScore < 0.7) {
                    correctClassifications++
                }
            }

            const accuracy = correctClassifications / mediumCases.length
            expect(accuracy).toBeGreaterThan(0.65)
        })

        it('should correctly classify no bias (<0.3)', async () => {
            const noneCases = ALL_BIAS_TEST_CASES.filter(t => t.expectedSeverity === 'none')
            let correctClassifications = 0

            for (const testCase of noneCases) {
                const analysis = await engine.analyzeSession(testCase.session)
                if (analysis.overallBiasScore < 0.3) {
                    correctClassifications++
                }
            }

            const accuracy = correctClassifications / noneCases.length
            expect(accuracy).toBeGreaterThan(0.85)
        })
    })

    describe('Error Analysis & Edge Cases', () => {
        it('should handle empty conversation history', async () => {
            const emptySession = {
                sessionId: 'test-empty',
                conversationHistory: [],
                metadata: {},
            }

            await expect(engine.analyzeSession(emptySession)).resolves.toBeDefined()
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

            const analysis = await engine.analyzeSession(longSession)
            expect(analysis.overallBiasScore).toBeGreaterThanOrEqual(0)
            expect(analysis.overallBiasScore).toBeLessThanOrEqual(1)
        })

        it('should handle multilingual content gracefully', async () => {
            const multilingualSession = {
                sessionId: 'test-multilingual',
                conversationHistory: [
                    {
                        role: 'user',
                        content: 'Me siento ansioso. I feel anxious. 我很担心。',
                        timestamp: new Date(),
                    },
                ],
                metadata: {},
            }

            await expect(engine.analyzeSession(multilingualSession)).resolves.toBeDefined()
        })

        it('should handle special characters and emojis', async () => {
            const specialCharsSession = {
                sessionId: 'test-special-chars',
                conversationHistory: [
                    {
                        role: 'user',
                        content: 'I feel 😊 but also 😢. #confused @therapist!!!',
                        timestamp: new Date(),
                    },
                ],
                metadata: {},
            }

            const analysis = await engine.analyzeSession(specialCharsSession)
            expect(analysis).toBeDefined()
        })
    })

    describe('Performance Benchmarks', () => {
        it('should analyze session within 500ms', async () => {
            const testCase = GENDER_BIAS_TESTS[0]
            const start = performance.now()
            await engine.analyzeSession(testCase.session)
            const duration = performance.now() - start

            expect(duration).toBeLessThan(500)
            console.log(`Analysis duration: ${duration.toFixed(2)}ms`)
        })

        it('should handle batch analysis efficiently', async () => {
            const batchSize = 10
            const testCases = ALL_BIAS_TEST_CASES.slice(0, batchSize)

            const start = performance.now()
            await Promise.all(testCases.map(tc => engine.analyzeSession(tc.session)))
            const duration = performance.now() - start

            const avgPerSession = duration / batchSize
            expect(avgPerSession).toBeLessThan(500)
            console.log(`Batch analysis avg: ${avgPerSession.toFixed(2)}ms/session`)
        })
    })

    describe('Confusion Matrix Analysis', () => {
        it('should generate confusion matrix for all categories', async () => {
            const matrix = {
                truePositive: 0,
                falsePositive: 0,
                trueNegative: 0,
                falseNegative: 0,
            }

            for (const testCase of ALL_BIAS_TEST_CASES) {
                const analysis = await engine.analyzeSession(testCase.session)
                const predictedHasBias = analysis.overallBiasScore > BIAS_THRESHOLD
                const actualHasBias = testCase.expectedBiasScore > BIAS_THRESHOLD

                if (predictedHasBias && actualHasBias) {
                    matrix.truePositive++
                } else if (predictedHasBias && !actualHasBias) {
                    matrix.falsePositive++
                } else if (!predictedHasBias && !actualHasBias) {
                    matrix.trueNegative++
                } else if (!predictedHasBias && actualHasBias) {
                    matrix.falseNegative++
                }
            }

            console.log('Confusion Matrix:', matrix)

            expect(matrix.truePositive).toBeGreaterThan(0)
            expect(matrix.trueNegative).toBeGreaterThan(0)

            // Validate false positive rate
            const fpRate = matrix.falsePositive / (matrix.falsePositive + matrix.trueNegative)
            expect(fpRate).toBeLessThan(TARGET_FP_RATE)

            // Validate sensitivity
            const sensitivity = matrix.truePositive / (matrix.truePositive + matrix.falseNegative)
            expect(sensitivity).toBeGreaterThan(TARGET_SENSITIVITY)
        })
    })
})
