// Mock module for @campfirein/cipher used in Vitest tests

export class Cipher {
  
  registerAgent(agentContext: any) {
    // Return a stub context object for testing
    return {
      id: agentContext?.id ?? 'mock-id',
      publicKey: agentContext?.publicKey ?? 'mock-public-key',
      // Add more fields as needed for tests
    };
  }
  // Add other stubbed methods as needed for tests
}
  