import { createBuildSafeLogger } from "../../../logging/build-safe-logger";
const logger = createBuildSafeLogger("server"); // Conditional module export for Python bridge

function createNoOpBridge(): {
  initialize(): Promise<void>;
  isReady(): boolean;
} {
  return {
    initialize: async () => {},
    isReady: () => false,
  };
}

export async function createMentalHealthAIPythonBridge(
  scriptPath?: string,
): Promise<{ initialize(): Promise<void>; isReady(): boolean }> {
  // Only import server implementation when actually in a Node.js environment
  if (typeof process !== "undefined" && process.versions?.node && typeof window === "undefined") {
    try {
      // Server environment - use real implementation with dynamic import to avoid bundling
      const modulePath = ["..", "..", "..", "server-only", "MentalHealthPythonBridge"].join("/");
      const module = await import(/* @vite-ignore */ modulePath);
      return new module.MentalHealthAIPythonBridge(scriptPath);
    } catch (error: unknown) {
      logger.warn("Failed to load server-side Python bridge, using no-op fallback:", error);
      return createNoOpBridge();
    }
  }

  return createNoOpBridge();
}
