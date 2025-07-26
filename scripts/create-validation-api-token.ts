/**
 * Generate a validation API token for GitHub Actions
 * This creates a token that can be used to authenticate with the validation endpoints
 */

/**
 * Simple secure token generation (simplified version of src/lib/security.ts)
 */
function generateSecureToken(length = 32): string {
  // Node.js implementation
  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2) +
    Math.random().toString(36).substring(2, 15)
  ).substring(0, length)
}

function createSignature(data: string): string {
  // Simple signature for development - in production you'd use proper crypto
  const SECRET_KEY = 'validation-api-key-secret'
  const encoder = new TextEncoder()
  const dataWithKey = encoder.encode(data + SECRET_KEY)
  return btoa(String.fromCharCode.apply(null, Array.from(dataWithKey)))
}

function createSecureToken(
  payload: Record<string, unknown>,
  expiresIn = 3600,
): string {
  const tokenData = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresIn,
    iat: Math.floor(Date.now() / 1000),
    jti: generateSecureToken(8),
  }

  const dataString = JSON.stringify(tokenData)
  const encodedData = btoa(dataString)
  const signature = createSignature(encodedData)

  return `${encodedData}.${signature}`
}

function generateValidationApiToken(): string {
  // Create a long-lived token (1 year) for GitHub Actions validation
  const payload = {
    purpose: 'ai-validation',
    scope: 'validation:read',
    issuer: 'github-actions',
    audience: 'validation-api',
    created: Date.now(),
  }

  // Generate token with 1 year expiration
  const expiresIn = 365 * 24 * 60 * 60 // 1 year in seconds
  const token = createSecureToken(payload, expiresIn)

  console.log('✅ Validation API Token Generated:')
  console.log('')
  console.log(`Token: ${token}`)
  console.log('')
  console.log('📋 Instructions:')
  console.log('1. Copy the token above')
  console.log('2. Go to your GitHub repository settings')
  console.log('3. Navigate to Settings → Secrets and variables → Actions')
  console.log('4. Click "New repository secret"')
  console.log('5. Name: VALIDATION_API_TOKEN')
  console.log('6. Paste the token as the value')
  console.log('')
  console.log(
    '⚠️  Important: Save this token securely - it cannot be regenerated with the same value',
  )

  return token
}

// Run the function
generateValidationApiToken()
