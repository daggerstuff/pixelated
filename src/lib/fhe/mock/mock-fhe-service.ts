/**
 * Mock FHE Service Implementation
 *
 * This file provides a mock implementation of the FHE service interface for
 * development, testing, and environments where actual FHE is not available.
 */

import { nanoid } from "nanoid";

import { createBuildSafeLogger } from "../../logging/build-safe-logger";
import { EmotionClassifier } from "../../memory/emotion-classifier";
import { EncryptionMode, FHEOperation } from "../types";
import type {
  EncryptedData,
  FHEConfig,
  FHEKeys,
  FHEOperationResult,
  FHEScheme,
  FHEService,
} from "../types";

const logger = createBuildSafeLogger("mock-fhe");

/**
 * Mock implementation of the FHE scheme
 */
export class MockFHEScheme implements FHEScheme {
  name = "MockFHE";
  version = "1.0.0";

  getOperations(): FHEOperation[] {
    return [
      FHEOperation.Addition,
      FHEOperation.Subtraction,
      FHEOperation.Multiplication,
      FHEOperation.Negation,
      FHEOperation.SENTIMENT,
      FHEOperation.CATEGORIZE,
      FHEOperation.ANALYZE,
      FHEOperation.EMOTION_CLASSIFY,
    ];
  }

  supportsOperation(operation: FHEOperation): boolean {
    return this.getOperations().includes(operation);
  }
}

/**
 * Mock implementation of FHEKeys for the mock service
 */
export interface MockFHEKeys extends FHEKeys {
  mockKeyId: string;
  mockCreated: number;
}

/**
 * Mock encrypted data structure
 * Implements the EncryptedData interface from ../types.ts
 *
 * SECURITY: originalValue stores a SHA-256 hash of the plaintext for
 * mock verification purposes. The actual plaintext is NEVER stored.
 * This prevents accidental PII exposure in logs/memory dumps.
 */
export interface MockEncryptedData<T = unknown> extends EncryptedData<T> {
  mockId: string;
  originalType: string;
  originalValueHash: string; // SHA-256 hash of original value (not plaintext)
  mockEncrypted: boolean;
  timestamp: number;
}

/**
 * Mock implementation of FHEService for testing
 * Implements the FHEService interface from ../types.ts
 */
export class MockFHEService implements FHEService {
  private initialized = false;
  public scheme: MockFHEScheme;
  private keyPair: MockFHEKeys | null = null;
  private readonly emotionClassifier: EmotionClassifier;

  constructor() {
    this.scheme = new MockFHEScheme();
    this.emotionClassifier = new EmotionClassifier();
    logger.info("Mock FHE service created");
  }

  /**
   * Initialize the mock FHE service
   */
  public async initialize(_options?: unknown): Promise<void> {
    logger.info("Initializing mock FHE service");
    // Simulate delay for initialization
    await new Promise((resolve) => setTimeout(resolve, 100));
    this.initialized = true;
  }

  /**
   * Check if the service is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if an operation is supported
   */
  public supportsOperation(operation: FHEOperation): boolean {
    return this.scheme.supportsOperation(operation);
  }

  /**
   * Generate mock encryption keys
   * Implements the generateKeys method from FHEService interface
   */
  public async generateKeys(_config?: FHEConfig): Promise<MockFHEKeys> {
    logger.info("Generating mock encryption keys");
    // Simulate delay for key generation
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Return mock keys that implement FHEKeys interface
    const created = new Date();
    const keyId = nanoid();

    this.keyPair = {
      keyId,
      createdAt: created,
      scheme: this.scheme.name,
      status: "active",
      mockKeyId: keyId,
      mockCreated: Date.now(),
    };

    return this.keyPair;
  }

  /**
   * Mock encrypt data
   * Implements the encrypt method from FHEService interface
   */
  public async encrypt(value: unknown, _options?: unknown): Promise<EncryptedData> {
    this.checkInitialized();
    logger.info("Mock encrypting data", { dataType: typeof value });

    // Get the type of the value
    const type = typeof value;
    let dataType: "number" | "string" | "boolean" | "array" | "object";

    if (type === "number" || type === "string" || type === "boolean") {
      dataType = type;
    } else if (Array.isArray(value)) {
      dataType = "array";
    } else {
      dataType = "object";
    }

    // Create mock encrypted data - store only hash of plaintext for mock verification
    // The actual plaintext is NEVER stored in mock mode
    const hashedData = await this.hashPlaintext(value);
    const encrypted: MockEncryptedData = {
      id: nanoid(),
      mockId: nanoid(6),
      data: value,
      dataType,
      originalType: type,
      originalValueHash: hashedData,
      mockEncrypted: true,
      timestamp: Date.now(),
      metadata: {
        encryptedAt: Date.now(),
        mode: EncryptionMode.FHE,
        isMock: true, // Mark as mock to help identify in diagnostics
      },
    };

    return encrypted;
  }

  /**
   * Mock decrypt data
   * Implements the decrypt method from FHEService interface
   */
  public async decrypt<T>(encryptedData: EncryptedData, _options?: unknown): Promise<T> {
    this.checkInitialized();

    // Handle both MockEncryptedData and standard EncryptedData
    const mockData = encryptedData as unknown as MockEncryptedData<T>;

    if (mockData?.originalValueHash && mockData?.data !== undefined) {
      logger.info("Mock decrypting data");
    }

    if (encryptedData?.data !== undefined) {
      return encryptedData.data as T;
    }

    throw new Error("Invalid mock encrypted data: no data field");
  }

  /**
   * Audit log stub for HIPAA compliance logging.
   * In production, replace with actual audit trail implementation.
   */
  public auditLog(event: string, data: Record<string, unknown>): void {
    logger.info(`[AUDIT] ${event}`, {
      timestamp: Date.now(),
      service: "MockFHEService",
      event,
      // Never log plaintext values - only hashes and metadata
      hasData: data && typeof data === "object",
    });
  }

  /**
   * Process encrypted data with a homomorphic operation
   * Implements the processEncrypted method from FHEService interface
   */
  public async processEncrypted(
    encryptedData: string,
    operation: FHEOperation | string,
    _params?: Record<string, unknown>,
  ): Promise<FHEOperationResult<string>> {
    this.checkInitialized();
    this.auditLog("processEncrypted.start", { operation });
    logger.info(`Processing encrypted data with operation ${operation}`);

    // Parse the encrypted data
    let data: MockEncryptedData;
    try {
      data = JSON.parse(encryptedData);
    } catch {
      throw new Error("Invalid encrypted data format");
    }

    // Process based on operation
    switch (operation as FHEOperation) {
      case FHEOperation.SENTIMENT:
        return this.mockSentimentAnalysis(data);

      case FHEOperation.CATEGORIZE:
        return this.mockCategorization(data, _params);

      case FHEOperation.ANALYZE:
        return this.mockPIIDetection(data, _params);

      case FHEOperation.EMOTION_CLASSIFY:
        return this.mockEmotionClassification(data, _params);

      case FHEOperation.Addition:
      case FHEOperation.Subtraction:
      case FHEOperation.Multiplication:
      case FHEOperation.DotProduct:
      case FHEOperation.Square:
      case FHEOperation.Negation:
      case FHEOperation.Rotation:
      case FHEOperation.Polynomial:
      case FHEOperation.Rescale:
      case FHEOperation.SUMMARIZE:
      case FHEOperation.TOKENIZE:
      case FHEOperation.FILTER:
      case FHEOperation.CUSTOM:
      case FHEOperation.WORD_COUNT:
      case FHEOperation.CHARACTER_COUNT:
      case FHEOperation.KEYWORD_DENSITY:
      case FHEOperation.READING_LEVEL:
        throw new Error(`Operation ${operation} not implemented in mock service`);
    }
    // Exhaustive — all FHEOperation cases handled above
    return undefined as unknown as FHEOperationResult<string>;
  }

  /**
   * Mock emotion classification (EMOTION_CLASSIFY operation)
   */
  private async mockEmotionClassification(
    data: MockEncryptedData,
    params?: Record<string, unknown>,
  ): Promise<FHEOperationResult<string>> {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 200));

    try {
      const originalText = data.data as string;
      if (typeof originalText === "string") {
        const multiLabel = (params?.["multiLabel"] as boolean) ?? true;
        const result = this.emotionClassifier.classify(originalText, multiLabel);

        // Encrypt the classification result to match real FHE behavior
        const encryptedResult = await this.encrypt(JSON.stringify(result));

        return {
          success: true,
          result: JSON.stringify(encryptedResult),
          operation: FHEOperation.EMOTION_CLASSIFY,
          metadata: {
            timestamp: Date.now(),
          },
        };
      }
    } catch {
      // Ignore parsing errors and fall through to default response
    }

    // Default response if processing fails
    const defaultResult = {
      categories: [],
      categoryScores: {},
      valence: 0.5,
      arousal: 0.5,
      dominance: 0.5,
      topCategory: null,
      topScore: 0,
      multiplier: 1.0,
    };

    const encryptedDefaultResult = await this.encrypt(JSON.stringify(defaultResult));

    return {
      success: true,
      result: JSON.stringify(encryptedDefaultResult),
      operation: FHEOperation.EMOTION_CLASSIFY,
      metadata: {
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Mock PII detection (ANALYZE operation)
   */
  private async mockPIIDetection(
    data: MockEncryptedData,
    params?: Record<string, unknown>,
  ): Promise<FHEOperationResult<string>> {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 250));

    try {
      const originalText = data.data as string;
      if (typeof originalText === "string") {
        const text = originalText.toLowerCase();

        // Simple PII detection simulation
        const piiTypes: string[] = [];
        if (text.includes("@")) piiTypes.push("email");
        if (/\d{3}-\d{2}-\d{4}/.test(text)) piiTypes.push("ssn");
        if (/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(text)) piiTypes.push("phone");

        const hasPII = piiTypes.length > 0;
        const confidence = hasPII ? 0.95 : 0.1;

        return {
          success: true,
          result: JSON.stringify({
            hasPII: String(hasPII),
            confidence: String(confidence),
            types: piiTypes.join(","),
            processed: true,
          }),
          operation: FHEOperation.ANALYZE,
          metadata: {
            timestamp: Date.now(),
          },
        };
      }
    } catch {
      // Fall through
    }

    return {
      success: true,
      result: JSON.stringify({
        hasPII: "false",
        confidence: "0",
        types: "",
        processed: true,
      }),
      operation: FHEOperation.ANALYZE,
      metadata: {
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Mock sentiment analysis
   */
  private async mockSentimentAnalysis(
    data: MockEncryptedData,
  ): Promise<FHEOperationResult<string>> {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Parse original text if it's a string
    try {
      const originalText = data.data as string;
      if (typeof originalText === "string") {
        // Simple sentiment detection based on keywords
        const positiveWords = ["good", "great", "excellent", "happy", "joy"];
        const negativeWords = ["bad", "poor", "sad", "unhappy", "terrible"];

        const text = originalText.toLowerCase();
        let sentiment = "neutral";

        const positiveCount = positiveWords.filter((word) => text.includes(word)).length;
        const negativeCount = negativeWords.filter((word) => text.includes(word)).length;

        if (positiveCount > negativeCount) {
          sentiment = "positive";
        } else if (negativeCount > positiveCount) {
          sentiment = "negative";
        }

        // Return encrypted result
        return {
          success: true,
          result: JSON.stringify({
            id: nanoid(),
            result: sentiment,
            confidence: 0.85,
            processed: true,
          }),
          operation: FHEOperation.SENTIMENT,
          metadata: {
            timestamp: Date.now(),
          },
        };
      }
    } catch {
      // Ignore parsing errors and fall through to default response
    }

    // Default response if processing fails
    return {
      success: true,
      result: JSON.stringify({
        id: nanoid(),
        result: "neutral",
        confidence: 0.5,
        processed: true,
      }),
      operation: FHEOperation.SENTIMENT,
      metadata: {
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Mock categorization
   */
  private async mockCategorization(
    data: MockEncryptedData,
    params?: Record<string, unknown>,
  ): Promise<FHEOperationResult<string>> {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Default categories
    const categories = {
      health: ["health", "medical", "doctor", "hospital", "wellness"],
      finance: ["money", "finance", "bank", "investment", "budget"],
      tech: ["computer", "technology", "software", "hardware", "digital"],
      personal: ["family", "friend", "relationship", "personal", "home"],
    };

    // Use provided categories if available
    const categoryMap = (params?.["categories"] as Record<string, string[]>) || categories;

    try {
      const originalText = data.data as string;
      if (typeof originalText === "string") {
        const text = originalText.toLowerCase();

        // Find matching categories
        const matches: Record<string, number> = {};

        for (const [category, keywords] of Object.entries(categoryMap)) {
          let count = 0;
          for (const keyword of keywords) {
            if (text.includes(keyword.toLowerCase())) {
              count++;
            }
          }
          if (count > 0) {
            matches[category] = count;
          }
        }

        // Sort categories by match count
        const sortedCategories = Object.entries(matches)
          .sort((a, b) => b[1] - a[1])
          .map(([category]) => category);

        // Return encrypted result
        return {
          success: true,
          result: JSON.stringify({
            id: nanoid(),
            categories: sortedCategories.length > 0 ? sortedCategories : ["uncategorized"],
            confidence: sortedCategories.length > 0 ? 0.7 : 0.3,
            processed: true,
          }),
          operation: FHEOperation.CATEGORIZE,
          metadata: {
            timestamp: Date.now(),
          },
        };
      }
    } catch {
      // Ignore parsing errors and fall through to default response
    }

    // Default response if processing fails
    return {
      success: true,
      result: JSON.stringify({
        id: nanoid(),
        categories: ["uncategorized"],
        confidence: 0.3,
        processed: true,
      }),
      operation: FHEOperation.CATEGORIZE,
      metadata: {
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Check if the service is initialized
   */
  private checkInitialized() {
    if (!this.initialized) {
      throw new Error("Mock FHE service not initialized. Call initialize() first.");
    }
  }

  /**
   * Encrypt multiple values into individual ciphertexts
   * @param values The values to encrypt
   * @returns Array of encrypted data
   */
  encryptBatch(values: unknown[]): Promise<EncryptedData[]> {
    return Promise.all(values.map((value) => this.encrypt(value)));
  }

  /**
   * Decrypt multiple ciphertexts
   * @param ciphertexts The encrypted data to decrypt
   * @returns Array of decrypted values
   */
  async decryptBatch<T>(ciphertexts: EncryptedData<T>[]): Promise<T[]> {
    return Promise.all(ciphertexts.map((ct) => this.decrypt<T>(ct)));
  }

  /**
   * Create SHA-256 hash of a value for mock verification.
   * Plaintext is never stored - only its hash for test verification.
   */
  private async hashPlaintext(value: unknown): Promise<string> {
    const jsonStr = JSON.stringify(value);
    // Prefer Web Crypto API (browser/jsdom compatible) over Node crypto
    let cryptoSubtle: SubtleCrypto | any;
    if (typeof globalThis.crypto?.subtle !== "undefined") {
      cryptoSubtle = globalThis.crypto.subtle;
    } else {
      const nodeCrypto = await import("node:crypto");
      if (!nodeCrypto.webcrypto.subtle) {
        throw new Error("Web Crypto API not available");
      }
      cryptoSubtle = nodeCrypto.webcrypto.subtle;
    }
    const data = new TextEncoder().encode(jsonStr);
    const hashBuffer = await cryptoSubtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
}

/**
 * Lazy singleton instance - avoids module-initialization race conditions.
 * Always access via getMockFHEService() to ensure proper initialization.
 */
let mockFHEServiceInstance: MockFHEService | undefined;

export function getMockFHEService(): MockFHEService {
  mockFHEServiceInstance ??= new MockFHEService();
  return mockFHEServiceInstance;
}

/** @deprecated Use getMockFHEService() instead of the singleton directly */
export const mockFHEService = new Proxy({} as MockFHEService, {
  get(_target, prop) {
    return getMockFHEService()[prop as keyof MockFHEService];
  },
});
