import React, { useCallback, useMemo, useState } from 'react'
import { fetchJSONWithRetry } from '@/lib/net/fetchWithRetry'
import type { FHEOperation } from '@/lib/fhe/types'

interface Props {
  defaultMessage?: string
}

export const FHEDemo: React.FC<Props> = ({ defaultMessage = 'Your data is protected with FHE technology' }) => {
  const [plainText, setPlainText] = useState('Therapist: How are you feeling today?')
  const [operation, setOperation] = useState<FHEOperation | 'word_count' | 'sentiment'>('word_count')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)

  const operations = useMemo(() => [
    { value: 'word_count', label: 'Word Count' },
    { value: 'character_count', label: 'Character Count' },
    { value: 'SENTIMENT', label: 'Sentiment (demo)' },
  ], [])

  const encryptLocally = useCallback(async (text: string) => {
    // Demo local "encryption" shim so we can send something that looks encrypted
    // The API/service will accept any string and process
    return `test-fhe:v1:${btoa(unescape(encodeURIComponent(text)))}`
  }, [])

  const handleProcess = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)
    try {
      const encryptedData = await encryptLocally(plainText)
      const json = await fetchJSONWithRetry<any>(
        '/api/fhe/process',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            encryptedData,
            operation,
            params: { demo: true },
          }),
        },
        { retries: 2, timeout: 8000 },
      )
      setResult(json.result ?? json)
    } catch (e: any) {
      setError(e.message || 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [encryptLocally, operation, plainText])

  const handleRotateKeys = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      await fetchJSONWithRetry('/api/fhe/rotate-keys', { method: 'POST' }, {
        retries: 2,
        timeout: 8000,
      })
    } catch (e: any) {
      setError(e.message || 'Failed to rotate keys')
    } finally {
      setIsLoading(false)
    }
  }, [])

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 bg-muted/30">
        <p className="text-sm text-muted-foreground">{defaultMessage}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 space-y-2">
          <label htmlFor="plaintext-message" className="text-sm font-medium">Plaintext Message</label>
          <textarea
            id="plaintext-message"
            className="w-full min-h-[120px] rounded border bg-background p-3"
            value={plainText}
            onChange={(e) => setPlainText(e.target.value)}
            placeholder="Type text to process under FHE"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="operation-select" className="text-sm font-medium">Operation</label>
          <select
            id="operation-select"
            className="w-full rounded border bg-background p-2"
            value={operation}
            onChange={(e) => setOperation(e.target.value as any)}
          >
            {operations.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>

          <button
            className="mt-4 w-full rounded bg-blue-600 py-2 text-white disabled:opacity-60"
            onClick={handleProcess}
            disabled={isLoading}
          >
            {isLoading ? 'Processing…' : 'Process Encrypted Data'}
          </button>

          <button
            className="mt-2 w-full rounded border py-2"
            onClick={handleRotateKeys}
            disabled={isLoading}
          >
            Rotate Keys
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-400 bg-red-50 p-3 text-red-700">
          {error}
        </div>
      )}

      <div className="rounded border p-4">
        <h3 className="mb-2 text-lg font-semibold">Result</h3>
        <pre className="overflow-auto text-sm">{JSON.stringify(result, null, 2)}</pre>
      </div>
    </div>
  )
}

export default FHEDemo
