import { E2bSandboxRunner, type E2bSandboxRunnerOptions } from './e2b'
import { ValidationOrchestrator, type ValidationResult } from './validation'

/**
 * Runs the E2B validation suite through the orchestrator (retry once + hard
 * time budget), wiring the real sandbox runner into the merge gate.
 */
export async function runE2bValidation(
  options: E2bSandboxRunnerOptions,
): Promise<ValidationResult> {
  const timeoutMs = (options.timeoutSec ?? 300) * 1000
  const orchestrator = new ValidationOrchestrator({ timeoutMs })
  return orchestrator.validate(new E2bSandboxRunner(options))
}
