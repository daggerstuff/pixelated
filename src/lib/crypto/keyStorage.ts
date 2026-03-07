/**
 * Interface for key storage options
 */
interface KeyStorageOptions {
  namespace: string
  region: string
  kmsKeyId?: string
  useKms: boolean
}

/**
 * Interface for stored key data
 */
interface StoredKeyData {
  keyId: string
  version: number
  createdAt: number
  expiresAt?: number
  algorithm: string
  purpose: string
  kmsKeyArn?: string
  encryptedKey?: string
}

import {
  KMSClient,
  GenerateDataKeyCommand,
  DecryptCommand,
} from '@aws-sdk/client-kms'

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb'

/**
 * Secure Key Storage Service
 * Manages encryption keys with AWS KMS and DynamoDB for storage
 */
export class KeyStorage {
  private namespace: string
  private kmsClient: KMSClient
  private dynamoClient: DynamoDBDocumentClient
  private useKms: boolean
  private kmsKeyId?: string
  private readonly tableName = 'encryption-keys'

  /**
   * Creates a new KeyStorage instance
   * @param options - Configuration options
   */
  constructor(options: KeyStorageOptions) {
    this.namespace = options.namespace
    this.useKms = options.useKms
    this.kmsKeyId = options.kmsKeyId

    // Initialize AWS clients
    const kmsClient = new KMSClient({ region: options.region })
    const dynamoClient = new DynamoDBClient({ region: options.region })
    this.kmsClient = kmsClient
    this.dynamoClient = DynamoDBDocumentClient.from(dynamoClient)
  }

  /**
   * Generates a unique key ID
   * @param purpose - Purpose of the key
   * @returns Unique key ID
   */
  private generateKeyId(purpose: string): string {
    return `${this.namespace}:${purpose}:${Date.now()}:${crypto.randomUUID()}`
  }

  /**
   * Stores a key securely in DynamoDB
   * @param keyId - ID of the key
   * @param keyData - Key data to store
   */
  async storeKey(keyId: string, keyData: StoredKeyData): Promise<void> {
    const item = {
      ...keyData,
      pk: `${this.namespace}#${keyData.purpose}`,
      sk: keyId,
      ttl: keyData.expiresAt ? Math.floor(keyData.expiresAt / 1000) : undefined,
    }

    await this.dynamoClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    )
  }

  /**
   * Retrieves a key from DynamoDB
   * @param keyId - ID of the key to retrieve
   * @returns The stored key data
   */
  async getKey(keyId: string): Promise<StoredKeyData | null> {
    const result = await this.dynamoClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          keyId,
        },
      }),
    )

    return (result.Item as StoredKeyData) || null
  }

  /**
   * Generates a new encryption key using AWS KMS
   * @param purpose - Purpose of the key
   * @param algorithm - Encryption algorithm
   * @param expiresInDays - Key expiration in days
   * @returns Key ID and stored key data
   */
  async generateKey(
    purpose: string,
    algorithm = 'AES_256',
    expiresInDays = 90,
  ): Promise<{ keyId: string; keyData: StoredKeyData }> {
    const keyId = this.generateKeyId(purpose)
    const now = Date.now()

    if (this.useKms) {
      // Generate a data key using KMS
      const dataKeyCommand = new GenerateDataKeyCommand({
        KeyId: this.kmsKeyId,
        KeySpec: 'AES_256',
      })

      const dataKeyResponse = await this.kmsClient.send(dataKeyCommand)

      if (!dataKeyResponse.CiphertextBlob || !dataKeyResponse.Plaintext) {
        throw new Error('Failed to generate data key')
      }

      const keyData: StoredKeyData = {
        keyId,
        version: 1,
        createdAt: now,
        expiresAt:
          expiresInDays > 0
            ? now + expiresInDays * 24 * 60 * 60 * 1000
            : undefined,
        algorithm,
        purpose,
        kmsKeyArn: this.kmsKeyId,
        encryptedKey: Buffer.from(dataKeyResponse.CiphertextBlob).toString(
          'base64',
        ),
      }

      // Store the encrypted key
      await this.storeKey(keyId, keyData)

      return { keyId, keyData }
    } else {
      throw new Error('KMS must be enabled for production use')
    }
  }

  /**
   * Rotates an existing key
   * @param keyId - ID of the key to rotate
   * @returns New key ID and key data
   */
  async rotateKey(
    keyId: string,
  ): Promise<{ keyId: string; keyData: StoredKeyData } | null> {
    const existingKeyData = await this.getKey(keyId)

    if (!existingKeyData) {
      return null
    }

    // Generate a new key with the same properties
    const { purpose, algorithm } = existingKeyData
    const expiresInDays = existingKeyData.expiresAt
      ? Math.floor(
          (existingKeyData.expiresAt - Date.now()) / (24 * 60 * 60 * 1000),
        )
      : 90

    // Generate a new key
    const newKey = await this.generateKey(purpose, algorithm, expiresInDays)

    // Update the version
    newKey.keyData.version = (existingKeyData.version || 0) + 1

    // Store the updated key
    await this.storeKey(newKey.keyId, newKey.keyData)

    return newKey
  }

  /**
   * Lists all keys for a specific purpose
   * @param purpose - Purpose to filter keys by
   * @returns Array of key IDs
   */
  async listKeys(purpose?: string): Promise<string[]> {
    const queryParams = purpose
      ? {
          TableName: this.tableName,
          KeyConditionExpression: 'pk = :pk',
          ExpressionAttributeValues: {
            ':pk': `${this.namespace}#${purpose}`,
          },
        }
      : {
          TableName: this.tableName,
          KeyConditionExpression: 'begins_with(pk, :namespace)',
          ExpressionAttributeValues: {
            ':namespace': this.namespace,
          },
        }

    const result = await this.dynamoClient.send(new QueryCommand(queryParams))
    return (result.Items || []).map((item) => item.keyId)
  }

  /**
   * Deletes a key from storage
   * @param keyId - ID of the key to delete
   * @returns True if deleted successfully
   */
  async deleteKey(keyId: string): Promise<boolean> {
    try {
      await this.dynamoClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            keyId,
          },
        }),
      )
      return true
    } catch (error: unknown) {
      console.error('Error deleting key:', error)
      return false
    }
  }

  /**
   * Decrypts a data key using KMS
   * @param encryptedKey - Base64 encoded encrypted key
   * @returns Decrypted key as Buffer
   */
  async decryptKey(encryptedKey: string): Promise<Buffer> {
    const decryptCommand = new DecryptCommand({
      CiphertextBlob: Buffer.from(encryptedKey, 'base64'),
      KeyId: this.kmsKeyId,
    })

    const decryptedData = await this.kmsClient.send(decryptCommand)

    if (!decryptedData.Plaintext) {
      throw new Error('Failed to decrypt key')
    }

    return Buffer.from(decryptedData.Plaintext)
  }
}

// Example PHI audit logging - uncomment and customize as needed
// logger.info('Accessing PHI data', {
//   userId: 'user-id-here',
//   action: 'read',
//   dataType: 'patient-record',
//   recordId: 'record-id-here'
// });
