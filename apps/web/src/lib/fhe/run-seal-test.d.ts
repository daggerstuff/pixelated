/// <reference types="node" />

declare function require(specifier: string): unknown

declare module 'node:child_process' {
  export interface ExecSyncOptions {
    stdio?: 'inherit' | 'ignore' | 'pipe' | unknown
    cwd?: string
    encoding?: BufferEncoding | 'buffer' | 'binary' | 'hex' | 'base64'
  }

  export function execSync(command: string, options?: ExecSyncOptions): unknown
}

declare module 'node:path' {
  export function resolve(...paths: string[]): string
  export function join(...paths: string[]): string
}

declare module 'node:fs' {
  export interface MkdirOptions {
    recursive?: boolean
  }

  export interface RmOptions {
    recursive?: boolean
    force?: boolean
  }

  export function existsSync(path: string): boolean
  export function mkdirSync(path: string, options?: MkdirOptions): void
  export function rmSync(path: string, options?: RmOptions): void
}

declare module 'node:process' {
  const process: {
    cwd(): string
    exit(code?: number): never
  }

  export default process
}
