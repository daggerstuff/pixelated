'use client'

import type {
  EncryptionMode,
  HomomorphicOperationResult,
} from '@/lib/fhe/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fheService } from '@/lib/fhe'
import { FHEOperation } from '@/lib/fhe/types'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

/**
 * FHE Demo Component for demonstrating Fully Homomorphic Encryption capabilities
 */
export interface FHEDemoProps {
  defaultMessage?: string
}

export function FHEDemo({
  defaultMessage = 'This is a secure message',
}: FHEDemoProps) {
  const [initialized, setInitialized] = useState(false)
  const [message, setMessage] = useState(defaultMessage)
  const [encryptedMessage, setEncryptedMessage] = useState('')
  const [decryptedMessage, setDecryptedMessage] = useState('')
  const [operation, setOperation] = useState<string>(FHEOperation.SENTIMENT)
  const [operationResult, setOperationResult] =
    useState<HomomorphicOperationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [encryptionMode, setEncryptionMode] =
    useState<string>('Not initialized')
  const [keyId, setKeyId] = useState<string>('Not generated')

  useEffect(() => {
    const initializeFHE = async () => {
      try {
        await fheService.initialize({
          mode: 'fhe' as EncryptionMode,
          securityLevel: 'tc256',
          keySize: 2048,
        })
        setInitialized(true)

        // Update encryption mode display
        try {
          // Use optional chaining and type checking
          if ('getEncryptionMode' in fheService) {
            const mode = (fheService as { getEncryptionMode(): EncryptionMode }).getEncryptionMode()
            setEncryptionMode(mode)
          } else {
            setEncryptionMode('initialized')
          }
        } catch (modeError) {
          console.warn('Could not get encryption mode:', modeError)
          setEncryptionMode('initialized')
        }

        // Get current key ID
        try {
          // Use optional chaining and type checking
          if ('rotateKeys' in fheService) {
            const keyRotationInfo = await (fheService as { rotateKeys(): Promise<string> }).rotateKeys()
            setKeyId(keyRotationInfo)
          } else {
            setKeyId('default-key')
          }
        } catch (keyError) {
          console.warn('Could not rotate keys:', keyError)
          setKeyId('default-key')
        }
      } catch (error) {
        setError(`Failed to initialize FHE: ${(error as Error).message}`)
      }
    }

    initializeFHE()
  }, [])

  const handleEncrypt = async () => {
    if (!message) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const encrypted = await fheService.encrypt(message)
      setEncryptedMessage(encrypted)
    } catch (error) {
      setError(`Encryption failed: ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDecrypt = async () => {
    if (!encryptedMessage) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const decrypted = await fheService.decrypt(encryptedMessage)
      setDecryptedMessage(decrypted as string)
    } catch (error) {
      setError(`Decryption failed: ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleProcess = async () => {
    if (!encryptedMessage) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Try API processing first since client-side might not be supported
      let result = null

      try {
        // Try API processing
        const response = await fetch('/api/fhe/process', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            encryptedData: encryptedMessage,
            operation: operation as FHEOperation,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'API processing failed')
        }

        result = data.result
      } catch (apiError) {
        // Fall back to client-side processing if available
        console.warn('API processing failed, trying client-side:', apiError)

        if ('processEncrypted' in fheService) {
          result = await (fheService as {
            processEncrypted(
              encryptedData: string,
              operation: FHEOperation | string,
              params?: Record<string, unknown>
            ): Promise<unknown>
          }).processEncrypted(
            encryptedMessage,
            operation as FHEOperation,
          )
        } else {
          throw new Error('No FHE processing method available')
        }
      }

      setOperationResult(result)
    } catch (error) {
      setError(`Processing failed: ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleRotateKeys = async () => {
    setLoading(true)
    setError(null)

    try {
      let newKeyId = ''

      try {
        // Try API rotation
        const response = await fetch('/api/fhe/rotate-keys', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'API key rotation failed')
        }

        newKeyId = data.keyId
      } catch (apiError) {
        // Fall back to client-side rotation if available
        console.warn('API key rotation failed, trying client-side:', apiError)

        if ('rotateKeys' in fheService) {
          newKeyId = await (fheService as { rotateKeys(): Promise<string> }).rotateKeys()
        } else {
          throw new Error('No key rotation method available')
        }
      }

      setKeyId(newKeyId)
    } catch (error) {
      setError(`Key rotation failed: ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Fully Homomorphic Encryption Demo</CardTitle>
        <CardDescription>
          Explore secure data processing with FHE technology
        </CardDescription>
        <div className="flex gap-2 mt-2">
          <Badge variant={initialized ? 'default' : 'destructive'}>
            {initialized ? 'FHE Initialized' : 'Not Initialized'}
          </Badge>
          <Badge variant="outline">Mode: {encryptionMode}</Badge>
          <Badge variant="outline">
            Key ID: {keyId.substring(0, 8)}
            ...
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="encrypt" className="w-full">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="encrypt">Encrypt</TabsTrigger>
            <TabsTrigger value="process">Process</TabsTrigger>
            <TabsTrigger value="decrypt">Decrypt</TabsTrigger>
          </TabsList>

          <TabsContent value="encrypt">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="message">Message to Encrypt</Label>
                <Input
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter a message to encrypt"
                />
              </div>

              <Button
                onClick={handleEncrypt}
                disabled={!initialized || loading || !message}
                className="w-full"
              >
                {loading ? 'Encrypting...' : 'Encrypt Message'}
              </Button>

              {encryptedMessage && (
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <Label>Encrypted Message</Label>
                  <p className="text-xs font-mono break-all mt-1">
                    {encryptedMessage}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="process">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Operation</Label>
                <div className="flex gap-2">
                  <Button
                    variant={
                      operation === FHEOperation.SENTIMENT
                        ? 'default'
                        : 'outline'
                    }
                    onClick={() => setOperation(FHEOperation.SENTIMENT)}
                  >
                    Sentiment
                  </Button>
                  <Button
                    variant={
                      operation === FHEOperation.CATEGORIZE
                        ? 'default'
                        : 'outline'
                    }
                    onClick={() => setOperation(FHEOperation.CATEGORIZE)}
                  >
                    Categorize
                  </Button>
                  <Button
                    variant={
                      operation === FHEOperation.SUMMARIZE
                        ? 'default'
                        : 'outline'
                    }
                    onClick={() => setOperation(FHEOperation.SUMMARIZE)}
                  >
                    Summarize
                  </Button>
                </div>
              </div>

              <Button
                onClick={handleProcess}
                disabled={!initialized || loading || !encryptedMessage}
                className="w-full"
              >
                {loading ? 'Processing...' : `Process with ${operation}`}
              </Button>

              {operationResult && (
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <Label>Operation Result</Label>
                  <pre className="text-xs font-mono mt-1 whitespace-pre-wrap">
                    {JSON.stringify(operationResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="decrypt">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="encryptedMessage">Encrypted Message</Label>
                <Input
                  id="encryptedMessage"
                  value={encryptedMessage}
                  onChange={(e) => setEncryptedMessage(e.target.value)}
                  placeholder="Enter an encrypted message"
                />
              </div>

              <Button
                onClick={handleDecrypt}
                disabled={!initialized || loading || !encryptedMessage}
                className="w-full"
              >
                {loading ? 'Decrypting...' : 'Decrypt Message'}
              </Button>

              {decryptedMessage && (
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <Label>Decrypted Message</Label>
                  <p className="mt-1">{decryptedMessage}</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md">
            {error}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reset Demo
        </Button>
        <Button
          variant="secondary"
          onClick={handleRotateKeys}
          disabled={!initialized || loading}
        >
          Rotate Encryption Keys
        </Button>
      </CardFooter>
    </Card>
  )
}

// Example PHI audit logging - uncomment and customize as needed
// logger.info('Accessing PHI data', {
//   userId: 'user-id-here',
//   action: 'read',
//   dataType: 'patient-record',
//   recordId: 'record-id-here'
// });
