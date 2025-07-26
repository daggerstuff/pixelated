#!/usr/bin/env node

/**
 * Key Rotation Scrip
 *
 * This script is designed to be run as a scheduled task (e.g., via cron)
 * to automatically rotate encryption keys based on their expiration dates.
 *
 * Usage:
 *   node rotateKeys.js [--force] [--purpose=<purpose>]
 *
 * Options:
 *   --force            Force rotation of all keys regardless of expiration
 *   --purpose=<value>  Only rotate keys with the specified purpose
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { createCryptoSystem } from '../lib/crypto/index'

// Parse command line arguments
const args = process.argv.slice(2)
const forceRotation = args.includes('--force')
const purposeArg = args.find((arg) => arg.startsWith('--purpose='))
const purpose = purposeArg ? purposeArg.split('=')[1] : undefined

// Configuration
const LOG_DIR = path.join(process.cwd(), 'logs')
const LOG_FILE = path.join(
  LOG_DIR,
  `key-rotation-${new Date().toISOString().split('T')[0]}.log`,
)

/**
 * Logs a message to both console and log file
 * @param message - Message to log
 */
async function log(message: string): Promise<void> {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${message}`

  console.log(logMessage)

  try {
    // Ensure log directory exists
    await fs.mkdir(LOG_DIR, { recursive: true })

    // Append to log file
    await fs.appendFile(LOG_FILE, `${logMessage}\n`)
  } catch {
    console.error('Failed to write to log file')
  }
}

/**
 * Main function to run key rotation
 */
async function main(): Promise<void> {
  await log('Starting key rotation process')

  try {
    // Create crypto system
    const crypto = createCryptoSystem({
      namespace: 'app',
      useSecureStorage: import.meta.env.PROD,
      keyRotationDays: 90,
    })

    await log(`Key rotation mode: ${forceRotation ? 'Force' : 'Automatic'}`)

    if (purpose) {
      await log(`Filtering by purpose: ${purpose}`)
    } else {
      await log('Not filtering by purpose')
    }

    if (forceRotation) {
      // Force rotation of all keys
      const keys = await crypto.keyStorage.listKeys(purpose)
      await log(`Found ${keys.length} keys to force rotate`)

      let rotatedCount = 0

      for (const keyId of keys) {
        try {
          const keyData = await crypto.keyStorage.getKey(keyId)
          if (!keyData) {
            continue
          }

          await log(`Force rotating key: ${keyId} (version ${keyData.version})`)
          const rotatedKey = await crypto.keyStorage.rotateKey(keyId)

          if (rotatedKey) {
            rotatedCount++
            await log(
              `Key rotated successfully: ${keyId} -> ${rotatedKey.keyId} (new version: ${rotatedKey.keyData.version})`,
            )
          }
        } catch (error) {
          await log(`Error rotating key ${keyId}: ${error}`)
        }
      }

      await log(
        `Force rotation complete. Rotated ${rotatedCount} of ${keys.length} keys.`,
      )
    } else {
      // Automatic rotation based on expiration
      await log('Checking for keys that need rotation')
      const rotatedKeys = await crypto.rotateExpiredKeys()

      if (rotatedKeys.length > 0) {
        await log(
          `Rotated ${rotatedKeys.length} expired keys: ${rotatedKeys.join(', ')}`,
        )
      } else {
        await log('No keys needed rotation')
      }
    }

    await log('Key rotation process completed successfully')
    process.exit(0)
  } catch (error) {
    await log(`Key rotation process failed: ${error}`)
    process.exit(1)
  }
}

// Run the main function
main().catch(async (error) => {
  await log(`Unhandled error: ${error}`)
  process.exit(1)
})
