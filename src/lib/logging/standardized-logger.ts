/**
 * Standardized logger implementation.
 * Provides factory functions for contextual loggers used throughout the application.
 */

export type Logger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
};

function createBuildSafeLogger(prefix: string): Logger {
  const tag = `[standardized-logger][${prefix}]`;
  return {
    info: (...args: unknown[]) => { console.info(tag, ...args); },
    warn: (...args: unknown[]) => { console.warn(tag, ...args); },
    error: (...args: unknown[]) => { console.error(tag, ...args); },
    debug: (...args: unknown[]) => { console.debug(tag, ...args); }
  };
}

// Factory functions for named loggers

export function getBiasDetectionLogger(scope: string): Logger {
  return createBuildSafeLogger(`bias-detection:${scope}`);
}

export function getClinicalAnalysisLogger(scope: string): Logger {
  return createBuildSafeLogger(`clinical-analysis:${scope}`);
}

export function getAiServiceLogger(scope: string): Logger {
  return createBuildSafeLogger(`ai-service:${scope}`);
}

export function getApiEndpointLogger(scope: string): Logger {
  return createBuildSafeLogger(`api-endpoint:${scope}`);
}

export function getComponentLogger(scope: string): Logger {
  return createBuildSafeLogger(`component:${scope}`);
}

export function getServiceLogger(scope: string): Logger {
  return createBuildSafeLogger(`service:${scope}`);
}

export function getSecurityLogger(scope: string): Logger {
  return createBuildSafeLogger(`security:${scope}`);
}

export function getAdvancedPHILogger(config: { enableLogCollection?: boolean } = {}): Logger {
  // Optionally could vary behavior based on config in real implementation.
  return createBuildSafeLogger(`advanced-phi${config.enableLogCollection ? ':collect' : ''}`);
}

export function getHipaaCompliantLogger(scope: string): Logger {
  return createBuildSafeLogger(`hipaa:${scope}`);
}

// Default/general loggers

export const standardizedLogger: Logger = createBuildSafeLogger('general');
export const appLogger: Logger = createBuildSafeLogger('app');
