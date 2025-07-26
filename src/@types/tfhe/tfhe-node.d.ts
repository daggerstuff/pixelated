declare module '@tfhe/tfhe-node' {
  export function createClientKey(params: unknown): unknown
  export function createServerKey(clientKey: unknown): unknown
  export function createPublicKey(clientKey: unknown): unknown
  export function encrypt(data: string, key: unknown): unknown
  export function decrypt(data: unknown, key: unknown): string
}
