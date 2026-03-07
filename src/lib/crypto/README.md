# Production Cryptography Library

This is a production-ready cryptography library that uses AWS KMS for key management and DynamoDB for key storage. The library provides secure encryption, hashing, and key management capabilities.

## Features

- AWS KMS integration for secure key management
- DynamoDB for encrypted key storage
- AES-256-GCM encryption with authenticated encryption
- Secure password hashing with scrypt and salt
- HMAC generation and verification
- CSRF token generation and verification
- Timing-safe comparisons for security operations
- Key rotation capabilities

## Setup

1. AWS Resources Required:
   - KMS Key: Create a symmetric KMS key in your AWS account
   - DynamoDB Table: Create a table named 'encryption-keys' with the following schema:
     - Primary Key: keyId (String)
     - GSI: pk (String) for querying by namespace and purpose
     - TTL field: ttl (Number)

2. Required Environment Variables:
   ```
   AWS_REGION=your-aws-region
   AWS_KMS_KEY_ID=your-kms-key-id
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   ```

## Usage

### Key Storage

```typescript
import { KeyStorage } from './keyStorage'

const keyStorage = new KeyStorage({
  namespace: 'myapp',
  region: process.env.AWS_REGION!,
  kmsKeyId: process.env.AWS_KMS_KEY_ID!,
  useKms: true
})

// Generate a new key
const { keyId, keyData } = await keyStorage.generateKey('data-encryption')

// Retrieve a key
const key = await keyStorage.getKey(keyId)

// Rotate a key
const newKey = await keyStorage.rotateKey(keyId)
```

### Encryption

```typescript
import { Encryption } from './encryption'

const encryption = new Encryption({
  namespace: 'myapp',
  region: process.env.AWS_REGION!,
  kmsKeyId: process.env.AWS_KMS_KEY_ID!
})

// Encrypt data
const encrypted = await encryption.encrypt('sensitive data', 'data-encryption')

// Decrypt data
const decrypted = await encryption.decrypt(encrypted)

// Rotate encryption key
const reEncrypted = await encryption.rotateKey(encrypted)
```

### Hashing and Security Functions

```typescript
import {
  sha256,
  hashPassword,
  verifyPassword,
  generateHmac,
  verifyHmac,
  generateCsrfToken,
  verifyCsrfToken
} from './hash'

// Hash a password
const { hash, salt } = await hashPassword('user-password')

// Verify a password
const isValid = await verifyPassword('user-password', hash, salt)

// Generate and verify HMAC
const hmac = generateHmac('data', 'secret-key')
const isValidHmac = verifyHmac('data', 'secret-key', hmac)

// CSRF protection
const csrfToken = generateCsrfToken()
const isValidToken = verifyCsrfToken(userToken, csrfToken)
```

## Security Considerations

1. Key Management:
   - KMS keys are automatically rotated yearly
   - Application keys can be rotated manually using the rotateKey functions
   - Expired keys are automatically removed via DynamoDB TTL

2. Encryption:
   - Uses AES-256-GCM for authenticated encryption
   - IVs are randomly generated for each encryption operation
   - Authentication tags ensure data integrity

3. Password Hashing:
   - Uses scrypt with secure parameters
   - Includes unique salt for each password
   - Implements timing-safe comparisons

4. CSRF Protection:
   - Generates cryptographically secure random tokens
   - Uses timing-safe comparisons for verification

## Error Handling

All functions use proper error handling and will throw descriptive errors when:
- AWS services are unavailable
- Keys are not found or invalid
- Decryption fails
- Authentication fails
- Input validation fails

## Maintenance

1. Key Rotation:
   - Implement regular key rotation using the provided rotation functions
   - Monitor key usage and expiration through AWS CloudWatch
   - Set up alerts for failed encryption/decryption operations

2. Monitoring:
   - Use AWS CloudWatch to monitor KMS and DynamoDB metrics
   - Set up alerts for unusual patterns or errors
   - Monitor key usage and rotation events

3. Backup:
   - DynamoDB table is automatically backed up
   - Consider enabling point-in-time recovery
   - Maintain backup of encryption contexts and metadata

## Development

When developing locally:
1. Use a development KMS key
2. Set up local DynamoDB for testing
3. Use proper IAM roles and permissions
4. Never use production keys in development

## Testing

Run the test suite:
```bash
pnpm test src/lib/crypto
```

Tests cover:
- Key generation and rotation
- Encryption and decryption
- Password hashing and verification
- HMAC operations
- CSRF token handling
- Error cases and edge conditions
