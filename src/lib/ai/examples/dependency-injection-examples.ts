/**
 * Example demonstrating dependency injection patterns with PatientResponseService
 * This file shows best practices for service instantiation and testing
 */

import type { PatientResponseService } from '../services/PatientResponseService'
import {
  createPatientResponseService,
  createTestPatientResponseService,
} from '../services/PatientResponseService'
import { EmotionSynthesizer } from '../emotions/EmotionSynthesizer'
import { PatientProfileService } from '../services/PatientProfileService'
import type { BeliefConsistencyService } from '../services/BeliefConsistencyService'
import { KVStore } from '../../db/KVStore'

// Example 1: Using the factory function for production code
export function createProductionService(): PatientResponseService {
  // Create required dependencies
  const kvStore = new KVStore('patient_profiles_', true)
  const profileService = new PatientProfileService(kvStore)

  // The factory handles dependency resolution with sensible defaults
  return createPatientResponseService({
    profileService,
    // emotionSynthesizer uses singleton by default
    // consistencyService uses new instance
  })
}

// Example 2: Using dependency injection for custom configuration
export function createCustomConfiguredService(
  customEmotionSynthesizer: EmotionSynthesizer,
): PatientResponseService {
  const kvStore = new KVStore('patient_profiles_', true)
  const profileService = new PatientProfileService(kvStore)

  return createPatientResponseService({
    profileService,
    emotionSynthesizer: customEmotionSynthesizer,
    // Other dependencies use defaults
  })
}

// Example 3: Testing pattern - isolated dependencies
export function createServiceForTesting(): PatientResponseService {
  // Create mock or test dependencies
  const mockKvStore = new KVStore('test_profiles_', false) // In-memory for tests
  const mockProfileService = new PatientProfileService(mockKvStore)

  // Each test gets its own isolated EmotionSynthesizer instance
  return createTestPatientResponseService({
    profileService: mockProfileService,
    // emotionSynthesizer uses isolated test instance
    // consistencyService uses new instance
  })
}

// Example 4: Testing with mocked dependencies
export function createServiceWithMocks(
  mockProfileService: PatientProfileService,
  mockConsistencyService: BeliefConsistencyService,
  mockEmotionSynthesizer: EmotionSynthesizer,
): PatientResponseService {
  return createTestPatientResponseService({
    profileService: mockProfileService,
    consistencyService: mockConsistencyService,
    emotionSynthesizer: mockEmotionSynthesizer,
  })
}

// Example 5: Singleton pattern usage
export function getSharedEmotionSynthesizer(): EmotionSynthesizer {
  // This ensures all services share the same emotional state
  return EmotionSynthesizer.getInstance()
}

// Example 6: Resetting for tests
export function resetEmotionSynthesizerForTests() {
  // Clear singleton state between tests
  EmotionSynthesizer.resetInstance()
}

/**
 * Benefits of this approach:
 *
 * 1. **Testability**: Easy to inject mocks and test dependencies in isolation
 * 2. **Flexibility**: Can configure different instances for different use cases
 * 3. **Consistency**: Singleton ensures shared state when needed
 * 4. **Maintainability**: Central configuration makes dependency changes easier
 * 5. **Performance**: Singleton avoids unnecessary instantiation overhead
 * 6. **Type Safety**: Full TypeScript support for all dependencies
 */
