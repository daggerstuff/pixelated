/**
 * Test data fixtures for bias detection scenarios
 *
 * This module provides realistic therapeutic session data for testing
 * bias detection capabilities across various scenarios including:
 * - Baseline scenarios (unbiased examples)
 * - Demographic bias scenarios (age, gender, race, socioeconomic)
 * - Clinical bias scenarios (diagnosis, treatment patterns)
 * - Edge cases and unusual scenarios
 */

export { baselineScenarios } from './baseline-scenarios'
export { demographicBiasScenarios } from './demographic-bias-scenarios'

// Convenience exports for individual scenarios
export {
  baselineAnxietyScenario,
  baselineDepressionScenario,
  baselinePainManagementScenario,
} from './baseline-scenarios'

export {
  ageBiasYoungPatient,
  ageBiasElderlyPatient,
} from './demographic-bias-scenarios'

/**
 * Get all test scenarios organized by category
 */
import { baselineScenarios } from './baseline-scenarios'
import { demographicBiasScenarios } from './demographic-bias-scenarios'

export const getAllTestScenarios = () => {
  return {
    baseline: baselineScenarios,
    demographicBias: demographicBiasScenarios,
  }
}

/**
 * Get scenarios specifically designed to test for bias (should trigger alerts)
 * This includes both favorable and unfavorable bias scenarios since both represent
 * systematic differences in treatment quality based on patient demographics.
 */
export const getBiasTestScenarios = () => {
  return {
    ageBiasYoungPatient: (demographicBiasScenarios as unknown)?.[
      'ageBiasYoungPatient'
    ],
    genderBiasFemalePatient: (demographicBiasScenarios as unknown)?.[
      'genderBiasFemalePatient'
    ],
    racialBiasMinorityPatient: (demographicBiasScenarios as unknown)?.[
      'racialBiasMinorityPatient'
    ],
    socioeconomicBiasLowIncomePatient: (demographicBiasScenarios as unknown)?.[
      'socioeconomicBiasLowIncomePatient'
    ],
    ageBiasElderlyPatient,
  }
}

/**
 * Get baseline scenarios that should NOT trigger bias alerts
 * These represent equitable, evidence-based treatment without demographic bias
 */
export const getBaselineTestScenarios = () => {
  const {
    baselineAnxietyScenario,
    baselineDepressionScenario,
    baselinePainManagementScenario,
  } = {
    baselineAnxietyScenario: (baselineScenarios as unknown)?.['anxiety'],
    baselineDepressionScenario: (baselineScenarios as unknown)?.['depression'],
    baselinePainManagementScenario: (baselineScenarios as unknown)?.[
      'painManagement'
    ],
  }

  return [
    baselineAnxietyScenario,
    baselineDepressionScenario,
    baselinePainManagementScenario,
  ]
}

/**
 * Get paired scenarios for comparative bias testing
 * Returns arrays of [favorable_treatment, unfavorable_treatment] pairs
 * These pairs demonstrate contrasting treatment quality for similar presentations
 * but different demographic characteristics.
 */
export const getComparativeBiasScenarios = () => {
  const { ageBiasYoungPatient, ageBiasElderlyPatient } = {
    ageBiasYoungPatient: (demographicBiasScenarios as unknown)?.['age']?.[
      'young'
    ],
    ageBiasElderlyPatient: (demographicBiasScenarios as unknown)?.['age']?.[
      'elderly'
    ],
  }

  return [
    [ageBiasYoungPatient, ageBiasElderlyPatient], // Age bias comparison
    // Additional comparative pairs can be added as more scenarios are implemented
  ]
}

/**
 * @deprecated Use getBaselineTestScenarios() instead
 * This function name was misleading as it included favorable bias scenarios
 */
export const getNonBiasTestScenarios = getBaselineTestScenarios
