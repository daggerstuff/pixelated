// Debug script to test URL validation
// Copy the validation function from the test file

// SSRF protection: Centralized URL validation utility
const ALLOWED_DOMAINS = [
  'huggingface.co',
  'mlflow.company.com',
  'api.wandb.ai',
  'ml.azure.com',
  'wandb.ai'
]

const validateUrlForSSRF = (urlString) => {
  try {
    const url = new URL(urlString)

    // Exact domain match only - no subdomain allowance for security
    const hostname = url.hostname.toLowerCase()
    if (!ALLOWED_DOMAINS.includes(hostname)) {
      return false
    }

    // Check for suspicious patterns
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1') ||
        hostname.includes('192.168.') || hostname.includes('10.') ||
        hostname.includes('172.') || hostname.includes('internal')) {
      return false
    }

    return true
  } catch (error) {
    // For relative URLs (e.g., '/api/*'), they are considered safe
    return urlString.startsWith('/') &&
           !urlString.includes('..') &&
           !urlString.includes('%2e%2e') && // URL-encoded '..'
           !urlString.includes('%5c') && // URL-encoded '\'
           !urlString.includes('..%2f') && // Double encoded path traversal
           /^[a-zA-Z0-9\-_.\/&=?]*$/.test(urlString) // Only safe characters
  }
}

const testUrls = [
  'url',  // This is the problematic one
  'https://huggingface.co/api/models',
  '/api/test',
  'https://example.com/api',
  'http://localhost:3000'
]

console.log('=== URL Validation Debug ===')
testUrls.forEach(url => {
  try {
    const result = validateUrlForSSRF(url)
    console.log(`URL: ${url} -> ${result ? '✅ ALLOWED' : '❌ BLOCKED'}`)
  } catch (error) {
    console.log(`URL: ${url} -> ERROR: ${error.message}`)
  }
})