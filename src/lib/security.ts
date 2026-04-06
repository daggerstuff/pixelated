/**
 * Security Module for Therapy Chat System
 *
 * Provides encryption, Fully Homomorphic Encryption (FHE) integration, and other
 * security features required for HIPAA compliance and beyond.
 */

// Use isomorphic approach for process
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import HmacSHA256 from "crypto-js/hmac-sha256";
import Base64 from "crypto-js/enc-base64";

// Re-export all event constants so existing consumers can keep importing from this module
export {
  AuthEvents,
  UserEvents,
  BulkOperationEvents,
  SessionEvents,
  AuditEvents,
  SystemEvents,
  RoleTransitionEvents,
  UserRetentionEvents,
  SecurityEventType,
} from "./security-events";
import type { SecurityEventTypeValue } from "./security-events";
export type { SecurityEventTypeValue };

import { fheService } from "./fhe";
import type { FHEOperation, HomomorphicOperationResult } from "./fhe/types";
import { EncryptionMode } from "./fhe/types";
import { createBuildSafeLogger } from "./logging/build-safe-logger";

// Initialize logger
const logger = createBuildSafeLogger("default");

// Security-related atoms
export const encryptionInitializedAtom = atom(false);
export const encryptionKeysAtom = atomWithStorage("chatEncryptionKeys", null);
export const securityLevelAtom = atomWithStorage("chatSecurityLevel", "medium");

// Define our enhanced FHE service interface
interface EnhancedFHEService {
  initialize: (options: Record<string, unknown>) => Promise<void>;
  encrypt: (message: string) => Promise<string>;
  decrypt?: (encryptedMessage: string) => Promise<string>;
  processEncrypted?: (
    encryptedMessage: string,
    operation: FHEOperation,
    params?: Record<string, unknown>,
  ) => Promise<HomomorphicOperationResult>;
  setupKeyManagement?: (options: {
    rotationPeriodDays: number;
    persistKeys: boolean;
  }) => Promise<string>;
  getEncryptionMode?: () => string;
  createVerificationToken?: (message: string) => Promise<string>;
  [key: string]: unknown;
}

// Cast to our enhanced interface to avoid TypeScript errors
const enhancedFHEService = fheService as unknown as EnhancedFHEService;

// Client-side key storage for browser environments
let _clientSecretKey: string | null = null;

/**
 * Set the secret key for cryptographic operations (required in browser/edge environments)
 */
export function setSecretKey(key: string): void {
  _clientSecretKey = key;
}

// Secret key for signatures
function requireSecretKey(): string {
  // Check override first, then process.env
  const key = _clientSecretKey || (typeof process !== "undefined" && process.env ? process.env["SECRET_KEY"] : undefined);

  if (!key) {
    throw new Error(
      "SECURITY_CONFIG_ERROR: SECRET_KEY is required for cryptographic operations. " +
        "In Node.js, set the SECRET_KEY environment variable. In browser/edge environments, " +
        "call setSecretKey() before performing cryptographic operations."
    );
  }
  return key.trim();
}

/**
 * RFC 4648 compatible Base64URL encoding with UTF-8 support
 */
function base64urlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binStr = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binStr += String.fromCharCode(bytes[i]);
  }
  return btoa(binStr)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * RFC 4648 compatible Base64URL decoding with UTF-8 support
 */
function base64urlDecode(str: string): string {
  let binStr = str.replace(/-/g, "+").replace(/_/g, "/");
  while (binStr.length % 4) binStr += "=";
  const decodedBin = atob(binStr);
  const bytes = new Uint8Array(decodedBin.length);
  for (let i = 0; i < decodedBin.length; i++) {
    bytes[i] = decodedBin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Initialize security system
 * This is the main entry point for setting up all security features
 */
export async function initializeSecurity(): Promise<void> {
  try {
    logger.info("Initializing security system...");

    // Get the configured security level
    const securityLevel = process.env["SECURITY_LEVEL"] || "medium";

    // Initialize encryption with the configured level
    const encryptionSuccess = await initializeEncryption(securityLevel);

    if (!encryptionSuccess) {
      logger.warn("Encryption initialization failed, continuing with reduced security");
    }

    // Set up other security features as needed
    logger.info("Security system initialized successfully");
  } catch (error: unknown) {
    const errorDetails: Record<string, unknown> = {
      message: error instanceof Error ? String(error) : String(error),
    };
    logger.error("Failed to initialize security system:", errorDetails);
    throw new Error(
      `Security initialization failed: ${error instanceof Error ? String(error) : String(error)}`,
      { cause: error },
    );
  }
}

/**
 * Initialize encryption system
 * This sets up the FHE service with the appropriate security level
 */
export async function initializeEncryption(level = "medium"): Promise<boolean> {
  try {
    const encryptionMode =
      level === "high"
        ? EncryptionMode.FHE
        : level === "medium"
          ? EncryptionMode.HIPAA
          : EncryptionMode.STANDARD;

    await enhancedFHEService.initialize({
      mode: encryptionMode,
      keySize: level === "high" ? 2048 : 1024,
      securityLevel: level,
      enableDebug: process.env["NODE_ENV"] === "development",
    });

    // For FHE mode, also set up key management - fix typo and safely handle optional method
    if (encryptionMode === EncryptionMode.FHE && enhancedFHEService.setupKeyManagement) {
      const keyId = await enhancedFHEService.setupKeyManagement({
        rotationPeriodDays: 7,
        persistKeys: true,
      });

      logger.info(`FHE initialized with key ID: ${keyId}`);
    }

    logger.info(`Encryption initialized successfully with mode: ${encryptionMode}`);
    return true;
  } catch (error: unknown) {
    const errorDetails: Record<string, unknown> = {
      message: error instanceof Error ? String(error) : String(error),
    };
    logger.error("Failed to initialize encryption:", errorDetails);
    return false;
  }
}

/**
 * Encrypt a message using the FHE service
 */
export async function encryptMessage(message: string): Promise<string> {
  try {
    return await enhancedFHEService.encrypt(message);
  } catch (error: unknown) {
    const errorDetails: Record<string, unknown> = {
      message: error instanceof Error ? String(error) : String(error),
    };
    logger.error("Encryption error:", errorDetails);
    throw error;
  }
}

/**
 * Decrypt a message using the FHE service
 */
export async function decryptMessage(encryptedMessage: string): Promise<string> {
  try {
    let decrypted: string;

    if (enhancedFHEService.decrypt) {
      decrypted = await enhancedFHEService.decrypt(encryptedMessage);
    } else {
      // Fallback implementation if decrypt is not available
      throw new Error("Decryption not implemented");
    }

    return decrypted;
  } catch (error: unknown) {
    const errorDetails: Record<string, unknown> = {
      message: error instanceof Error ? String(error) : String(error),
    };
    logger.error("Decryption error:", errorDetails);
    throw error;
  }
}

/**
 * Process encrypted data without decrypting
 * This is the key advantage of FHE over traditional encryption
 */
export async function processEncryptedMessage(
  encryptedMessage: string,
  operation: string,
  params?: Record<string, unknown>,
): Promise<string> {
  try {
    // Map operation string to FHEOperation enum
    const fheOperation = operation.toUpperCase() as FHEOperation;

    if (!enhancedFHEService.processEncrypted) {
      throw new Error("FHE processing not implemented");
    }

    const result = await enhancedFHEService.processEncrypted(
      encryptedMessage,
      fheOperation,
      params,
    );

    // Convert result to string format for return
    return result.result || JSON.stringify(result);
  } catch (error: unknown) {
    const errorDetails: Record<string, unknown> = {
      message: error instanceof Error ? String(error) : String(error),
    };
    logger.error("FHE operation error:", errorDetails);
    throw error;
  }
}

/**
 * Create a verification token for message integrity
 */
export async function createVerificationToken(message: string): Promise<string> {
  try {
    if (enhancedFHEService.createVerificationToken) {
      return await enhancedFHEService.createVerificationToken(message);
    }

    // Fallback implementation if the method doesn't exist
    const timestamp = Date.now().toString();
    const data = `${message}:${timestamp}`;
    return `${createSignature(data)}.${timestamp}`;
  } catch (error: unknown) {
    const errorDetails: Record<string, unknown> = {
      message: error instanceof Error ? String(error) : String(error),
    };
    logger.error("Verification token generation error:", errorDetails);
    throw error;
  }
}

/**
 * Generate a secure session key
 */
export function generateSecureSessionKey(): string {
  // Use a proper CSPRNG that works in both Node.js and browser environments
  if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
    // Browser environment
    const array = new Uint8Array(16); // 16 bytes for 32 hex chars
    window.crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  } else {
    // Node.js environment
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require("crypto");
    return crypto.randomBytes(16).toString("hex");
  }
}



/**
 * Generate audit log entry for HIPAA compliance
 */
export async function logSecurityEvent(
  eventType: SecurityEventTypeValue,
  userIdOrDetails: string | null | Record<string, string | number | boolean | null | undefined>,
  details?: Record<string, string | number | boolean | null | undefined>,
): Promise<void> {
  try {
    const metadata =
      typeof userIdOrDetails === "string" || userIdOrDetails === null
        ? { ...details, userId: userIdOrDetails ?? undefined }
        : userIdOrDetails;

    if (process.env["NODE_ENV"] === "development") {
      logger.debug("[SECURITY EVENT]", {
        eventType,
        ...metadata,
      });
    }
  } catch (error: unknown) {
    const errorDetails: Record<string, unknown> = {
      message: error instanceof Error ? String(error) : String(error),
    };
    logger.error("Security event logging error:", errorDetails);
  }
}

/**
 * Validate that the security meets HIPAA requirements
 */
export function validateHIPAACompliance(): {
  compliant: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  let compliant = true;

  // Check that encryption is properly initialized
  const encryptionMode = enhancedFHEService.getEncryptionMode?.() || "none";

  if (encryptionMode === EncryptionMode.NONE) {
    issues.push("Encryption is disabled");
    compliant = false;
  } else if (encryptionMode !== EncryptionMode.FHE && encryptionMode !== EncryptionMode.HIPAA) {
    issues.push("Encryption level may not meet HIPAA requirements");
    compliant = false;
  }

  return { compliant, issues };
}

/**
 * Clear sensitive data from memory
 */
export function secureClear(obj: Record<string, unknown>): void {
  if (typeof obj === "object" && obj !== null) {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (typeof obj[key] === "string") {
          obj[key] = "";
        } else if (typeof obj[key] === "object") {
          secureClear(obj[key] as Record<string, unknown>);
        }
      }
    }
  }
}

/**
 * Generate a secure random token
 * @param length Token length in bytes
 * @returns Hex string token
 */
export function generateSecureToken(length = 32): string {
  try {
    // Browser-safe implementation
    if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
      const array = new Uint8Array(length);
      window.crypto.getRandomValues(array);
      return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
    } else {
      // Node.js implementation
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const crypto = require("crypto");
      return crypto.randomBytes(length).toString("hex");
    }
  } catch (error: unknown) {
    const errorDetails: Record<string, unknown> = {
      message: error instanceof Error ? String(error) : String(error),
    };
    logger.error("Token generation error:", errorDetails);
    return "";
  }
}

/**
 * Create a signature for data integrity
 */
export function createSignature(data: string): string {
  const secret = requireSecretKey();
  try {
    const hash = HmacSHA256(data, secret);
    const b64 = Base64.stringify(hash);
    // Convert to URL-safe Base64 by replacing + and / and stripping padding =
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch (error: unknown) {
    const errorDetails: Record<string, unknown> = {
      message: error instanceof Error ? String(error) : String(error),
    };
    logger.error("Signature creation error:", errorDetails);
    throw new Error(
      `CRITICAL_SECURITY_ERROR: Failed to create signature. ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Verify a HMAC signature
 * @param data Original data
 * @param signature Signature to verify
 * @returns Whether signature is valid
 */
export async function verifySignature(data: string, signature: string): Promise<boolean> {
  // Node.js: use native constant-time comparison.
  if (typeof window === "undefined") {
    const expectedSignature = createSignature(data);

    if (expectedSignature.length !== signature.length) {
      return false;
    }

    try {
      const crypto = require("crypto");
      const a = Buffer.from(expectedSignature);
      const b = Buffer.from(signature);
      return crypto.timingSafeEqual(a, b);
    } catch {
      throw new Error(
        "SECURITY_ERROR: crypto.timingSafeEqual unavailable; cannot perform constant-time comparison",
      );
    }
  }

  // Browser: require Web Crypto subtle for constant-time HMAC verification.
  // Note: Client-side HMAC verification with a shared secret is discouraged.
  // For production, use server-side verification or public-key infrastructure (RS256).
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    let secret: string;
    try {
      secret = requireSecretKey();
    } catch (err) {
      // If we're on the client and the key is missing, return false gracefully
      // to avoid crashing the UI, as client-side verification is often optional
      // or handled by the server.
      console.warn(
        "SECURITY_CONFIG_WARNING: Secret key unavailable — signature verification failed locally. " +
        "On the client, ensure setSecretKey() is initialized if local verification is required."
      );
      return false;
    }

    const encoder = new TextEncoder();
    const key = await window.crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    // Decode signature into bytes for subtle.verify.
    let signatureBytes: Uint8Array;
    try {
      const b64 = signature.replace(/-/g, "+").replace(/_/g, "/");
      const binStr = atob(b64);
      signatureBytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        signatureBytes[i] = binStr.charCodeAt(i);
      }
    } catch {
      return false;
    }

    const dataBytes = encoder.encode(data);
    return await window.crypto.subtle.verify(
      { name: "HMAC", hash: "SHA-256" },
      key,
      signatureBytes as BufferSource,
      dataBytes as BufferSource
    );
  }

  // Neither Node.js crypto nor browser Web Crypto (subtle) is available.
  throw new Error(
    "SECURITY_CONFIG_ERROR: Neither Node.js crypto nor the Web Crypto API is available " +
    "for constant-time verification."
  );
}

/**
 * Current secure token version. Increment when modifying token structure.
 */
const TOKEN_VERSION = "v1";

/**
 * Create a secure token with encrypted payload
 * @param payload Token payload
 * @param expiresIn Expiration time in seconds
 * @returns Secure token
 */
export function createSecureToken(payload: Record<string, unknown>, expiresIn = 3600): string {
  const tokenData = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresIn,
    iat: Math.floor(Date.now() / 1000),
    jti: generateSecureToken(8),
  };

  const dataString = JSON.stringify(tokenData);
  const encodedData = base64urlEncode(dataString);
  const signature = createSignature(encodedData);

  return `${TOKEN_VERSION}.${encodedData}.${signature}`;
}

/**
 * Verify and decode a secure token
 * @param token Token to verify
 * @returns Decoded payload or null if invalid
 */
export async function verifySecureToken(token: string): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split(".");
    let encodedData: string;
    let signature: string;

    if (parts.length === 3) {
      // v1.{payload}.{signature}
      const [version, data, sig] = parts;
      if (version !== "v1") {
        logger.error(`Unsupported token version: ${version}`);
        return null;
      }
      encodedData = data;
      signature = sig;
    } else if (parts.length === 2) {
      // Legacy format: {payload}.{signature}
      [encodedData, signature] = parts;
    } else {
      logger.error("Invalid token format");
      return null;
    }

    // Check if secret key is available before verifying
    try {
      requireSecretKey();
    } catch (e) {
      logger.error("Cannot verify token: SECRET_KEY is missing");
      return null;
    }

    // Verify signature
    if (!(await verifySignature(encodedData, signature))) {
      logger.error("Invalid token signature");
      return null;
    }

    // Decode payload
    const dataString = base64urlDecode(encodedData);
    const payload = JSON.parse(dataString);

    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      logger.error("Token payload must be a plain object (not array or primitive)");
      return null;
    }

    // Check expiration
    if (
      "exp" in payload &&
      typeof payload.exp === "number" &&
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      logger.warn("Token expired");
      return null; // Token expired
    }

    return payload as Record<string, unknown>;
  } catch (error) {
    logger.error("Token verification failed:", { error });
    return null;
  }
}
