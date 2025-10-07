import type { ClientKey, ServerKey, PublicKey, EncryptedData } from '../../lib/fhe/types'

declare module '@tfhe/tfhe-node' {
  export function createClientKey(params: unknown): ClientKey
  export function createServerKey(clientKey: ClientKey): ServerKey
  export function createPublicKey(clientKey: ClientKey): PublicKey
  export function encrypt(data: string, key: PublicKey): EncryptedData<string>
  export function decrypt(data: EncryptedData<string>, key: ClientKey): string
}
