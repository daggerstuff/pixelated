# Fully Homomorphic Encryption (FHE) Module

This module provides a production-grade Fully Homomorphic Encryption (FHE)
implementation for the therapy chat system using Microsoft SEAL Library via
node-seal.

## Overview

Fully Homomorphic Encryption (FHE) allows computation on encrypted data without
decrypting it first. This is particularly valuable for therapy chat applications
where sensitive client information needs to remain private while still allowing
AI models to process the data.

## Features

- **Production-grade encryption** using Microsoft SEAL Library, a leading FHE
  implementation
- **Multiple encryption schemes** (BFV, BGV, CKKS) for different use cases
- **WebAssembly integration** for client-side FHE operations
- **Homomorphic Operations**: Perform operations on encrypted data:
  - Sentiment analysis
  - Text categorization
  - Content summarization
  - Text tokenization
  - Content filtering
- **Privacy-Preserving Analytics**: Process and visualize encrypted data without
  decryption:
  - Sentiment trends
  - Topic clustering
  - Emotional pattern detection
  - Intervention effectiveness analysis
  - Risk assessment
- **Encrypted Memory & Session Storage**: Secure storage for therapy session data
- **Crisis Detection**: Homomorphic pattern matching for risk assessment
- **Performance Caching**: Optimized FHE operations with intelligent caching

## Implementation Details

The implementation uses:

- [Microsoft SEAL](https://github.com/microsoft/SEAL) via
  [node-seal](https://github.com/morfix-io/node-seal) for Node.js environments
- [SEAL-Web](https://github.com/morfix-io/seal-wasm) for browser environments
  (via WebAssembly)
- AES-256-GCM for standard encryption modes
- Node.js crypto module for cryptographic operations

## Security Modes

The module supports different encryption modes:

- `NONE`: No encryption
- `STANDARD`: AES-256-GCM encryption
- `HIPAA`: HIPAA-compliant AES-256-GCM encryption with additional safeguards
- `FHE`: Fully Homomorphic Encryption using Microsoft SEAL

## Usage

### Initialize the FHE Service

```typescript
import { EncryptionMode, fheService } from '@/lib/fhe'

// Initialize with default settings
await fheService.initialize()

// Or with custom settings
await fheService.initialize({
  mode: EncryptionMode.FHE,
  keySize: 2048,
  securityLevel: 'high',
  enableDebug: true,
})
```

### Encrypt a Message

```typescript
const plaintext = 'Client message with sensitive information'
const encrypted = await fheService.encrypt(plaintext)
```

### Decrypt a Message

```typescript
const decrypted = await fheService.decrypt(encrypted)
console.log(decrypted) // "Client message with sensitive information"
```

### Process Encrypted Data

```typescript
import { FHEOperation } from '@/lib/fhe'

// Analyze sentiment without decryption
const sentimentResult = await fheService.processEncrypted(
  encrypted,
  FHEOperation.SENTIMENT,
)

// The result is still encrypted
const sentiment = await fheService.decrypt(sentimentResult)
console.log(sentiment) // "positive", "negative", or "neutral"
```

### Generate Analytics on Encrypted Conversations

```typescript
import { AnalyticsType, fheAnalytics } from '@/lib/fhe/analytics'

// Initialize analytics service
await fheAnalytics.initialize()

// Analyze sentiment trends in encrypted messages
const sentimentTrend = await fheAnalytics.analyzeSentimentTrend(messages)

// Create a full analytics dashboard
const dashboard = await fheAnalytics.createAnalyticsDashboard(messages)
```

### Encrypted Memory & Session Storage

```typescript
import { encryptedMemory } from '@/lib/fhe/encrypted-memory'

// Create encrypted session
const session = await encryptedMemory.createSession(
  'session-123',
  'therapist-456',
  messages,
)

// Store emotional state
await encryptedMemory.storeEmotionalState(
  'session-123',
  [0.8, 0.2, 0.1],
  'emotion',
)

// Analyze emotional trajectory
const trajectory =
  await encryptedMemory.analyzeEmotionalTrajectory('session-123')
```

### Crisis Detection on Encrypted Patterns

```typescript
import { crisisDetection } from '@/lib/fhe/crisis-detection'

// Analyze messages for crisis indicators
const assessment = await crisisDetection.analyzeMessages(
  'session-123',
  messages,
)

// Check risk level
if (assessment.riskLevel === 'critical') {
  await crisisDetection.alertOnCriticalRisk(assessment)
}
```

### FHE Caching for Performance

```typescript
import { fheCache } from '@/lib/fhe/fhe-cache'

// Pre-warm cache with common patterns
await fheCache.prewarmCache()

// Get cache statistics
const stats = fheCache.getStats()
console.log(`Hit rate: ${stats.hitRate * 100}%`)
```

## Architecture

The FHE module consists of:

1. **FHEService**: Main service class implementing the singleton pattern
2. **EncryptionMode**: Enum of available encryption modes
3. **FHEOperation**: Enum of operations that can be performed on encrypted data
4. **SEAL Context**: Management of cryptographic keys and operations
5. **Types**: Interfaces for requests, responses, and metadata
6. **EncryptedMemory**: Session and memory storage with FHE
7. **CrisisDetection**: Homomorphic pattern matching for risk assessment
8. **FHECache**: Performance optimization with intelligent caching

## Microsoft SEAL Implementation Details

This implementation uses Microsoft SEAL Library, which provides the following
homomorphic encryption schemes:

1. **BFV Scheme**: Best for integer arithmetic. Used for counting, sorting, and
   other integer-based operations.
2. **BGV Scheme**: Similar to BFV but with different optimizations. Used for
   integer operations.
3. **CKKS Scheme**: Designed for approximate arithmetic with real numbers. Used
   for floating-point operations.

The implementation includes:

- **SealContext**: Manages the SEAL library context and parameters
- **SealService**: Provides encryption/decryption services
- **SealOperations**: Implements homomorphic operations (add, multiply, etc.)
- **SealMemoryManager**: Manages SEAL memory resources to prevent leaks

## Running the FHE Test

To verify that the FHE implementation is working correctly, run:

```bash
# Using pnpm
pnpm run test:fhe

# Or using npm
npm run test:fhe
```

This will run a series of tests to verify that encryption, decryption, and basic
homomorphic operations work as expected.

## Performance Considerations

FHE operations are computationally intensive. Consider the following:

1. Key generation is slow and should be done during initialization
2. Encrypting and decrypting with FHE takes more time than standard encryption
3. Homomorphic operations are slower than plaintext operations
4. For maximum performance, consider using:
   - FHE caching layer (`fheCache`)
   - Web Workers for FHE operations
   - Batch encryption/decryption operations
   - Session-based caching for repeated operations

## Security Considerations

While using FHE:

1. Store private keys securely and never expose them
2. Use proper key rotation policies
3. Apply appropriate access controls to FHE operations
4. Monitor for timing attacks and side-channel vulnerabilities
5. Ensure all communication channels are properly secured
6. Use HIPAA-compliant encryption modes for patient data

## Real-world Application

In the therapy chat context, FHE enables:

1. AI models to analyze encrypted therapy transcripts without seeing the content
2. Detection of concerning patterns without compromising patient privacy
3. Generation of insights while maintaining HIPAA compliance
4. Secure collaboration between different healthcare providers
5. Encrypted session storage for longitudinal therapy tracking
6. Real-time crisis detection on encrypted data
7. Performance optimization through intelligent caching

## Module Structure

```
src/lib/fhe/
├── types.ts                    # Type definitions and interfaces
├── fhe-service.ts              # Main FHE service implementation
├── fhe-factory.ts              # Service factory with mock/real implementations
├── encrypted-text-processor.ts # Text processing on encrypted data
├── fhe-emotion-classifier.ts   # Emotion classification on encrypted data
├── analytics.ts                # Privacy-preserving analytics
├── encrypted-memory.ts         # Encrypted session & memory storage (NEW)
├── crisis-detection.ts         # Crisis detection on encrypted patterns (NEW)
├── fhe-cache.ts                # Performance caching layer (NEW)
├── seal-service.ts             # SEAL library wrapper
├── seal-operations.ts          # Homomorphic operations
├── zk-proof-service.ts         # Zero-knowledge proof verification
├── sp1-prover.ts               # SP1 proof generation
├── mock/                       # Mock implementations for testing
└── __tests__/                  # Test suites
```
