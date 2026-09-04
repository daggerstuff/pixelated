import { getStartupLogger } from "./logging/build-safe-logger";

const startupLogger = getStartupLogger();
import { LogRotationService } from "./logging/rotation";
import { initializeSecurity } from "./security";
import { initializeTracing } from "./tracing";

const logger = startupLogger;

/**
 * Initialize the application
 * This should be called when the application starts
 */
export async function initializeApplication(): Promise<void> {
  try {
    logger.info("Starting application initialization...");

    // Initialize tracing first (before other modules that might use it)
    initializeTracing();

    // Initialize log rotation
    const logRotation = new LogRotationService();
    await logRotation.ensureLogDir();

    // Initialize security module
    await initializeSecurity();

    logger.info("Application initialization complete");
  } catch (error: unknown) {
    logger.error("Failed to initialize application", error);
    throw error;
  }
}

/**
 * Shutdown the application gracefully
 */
export async function shutdownApplication(): Promise<void> {
  try {
    logger.info("Starting application shutdown...");

    // Shutdown tracing (export any pending spans)
    const { shutdownTracing } = await import("./tracing");
    await shutdownTracing();

    // Close database connections
    const dbModule = await import("./db");
    await dbModule.closeDatabase();
    // Stop background services
    const workerModule = (await import("./jobs/worker")) as {
      shutdown?: () => Promise<void>;
    };
    await workerModule.shutdown?.();
    // Save any pending data
    const notifModule = (await import("./services/notification/NotificationService")) as {
      flushPending?: () => Promise<void>;
    };
    await notifModule.flushPending?.();
    // Clean up resources
    const securityModule = (await import("./security")) as {
      cleanup?: () => Promise<void>;
    };
    await securityModule.cleanup?.();

    logger.info("Application shutdown complete");
  } catch (error: unknown) {
    logger.error("Error during application shutdown", error);
    throw error;
  }
}
