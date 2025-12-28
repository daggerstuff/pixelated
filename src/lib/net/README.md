Networking helpers

- fetchWithRetry / fetchJSONWithRetry: wraps fetch with per-attempt timeout and exponential backoff retries. Use this for demo API calls to improve resilience and UX.

Usage example:

import { fetchJSONWithRetry } from '@/lib/net/fetchWithRetry'

const data = await fetchJSONWithRetry('/api/foo', { method: 'GET' }, { retries: 2, timeout: 8000 })
