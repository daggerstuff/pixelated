// Cipher context sharing utility for Pixelated Empathy platform
// Follows MCP integration, security, and error handling best practices

import Cipher from '@byterover/cipher';
import type { CipherOptions, ContextPayload } from '@byterover/cipher';

// Environment variable names (do NOT hardcode secrets)
const {CIPHER_API_KEY, CIPHER_PROJECT_ID} = process.env;

// Validate required environment variables
if (!CIPHER_API_KEY || !CIPHER_PROJECT_ID) {
  throw new Error(
    'Cipher integration error: CIPHER_API_KEY and CIPHER_PROJECT_ID must be set in environment variables.'
  );
}

// Cipher initialization with secure config
const cipherOptions: CipherOptions = {
  apiKey: CIPHER_API_KEY,
  projectId: CIPHER_PROJECT_ID,
  // Optionally: endpoint, timeout, etc.
};

const cipher = new Cipher(cipherOptions);

/**
 * Shares agent context with the Cipher service.
 * @param agentId - Unique agent identifier
 * @param context - Serializable context payload
 * @returns Promise<void>
 */
export async function shareContext(agentId: string, context: ContextPayload): Promise<void> {
  try {
    // Validate input
    if (!agentId || typeof agentId !== 'string') {
      throw new TypeError('Invalid agentId for shareContext');
    }
    if (!context || typeof context !== 'object') {
      throw new TypeError('Invalid context payload for shareContext');
    }
    await cipher.shareContext(agentId, context);
  } catch (error) {
    // Log and rethrow for upstream error handling
    console.error('[Cipher] shareContext error:', error);
    throw error;
  }
}

/**
 * Retrieves shared context for an agent.
 * @param agentId - Unique agent identifier
 * @returns Promise<ContextPayload | null>
 */
export async function getContext(agentId: string): Promise<ContextPayload | null> {
  try {
    if (!agentId || typeof agentId !== 'string') {
      throw new TypeError('Invalid agentId for getContext');
    }
    const context = await cipher.getContext(agentId);
    return context ?? null;
  } catch (error) {
    console.error('[Cipher] getContext error:', error);
    return null;
  }
}

// Export the Cipher instance for advanced usage if needed
export { cipher };
