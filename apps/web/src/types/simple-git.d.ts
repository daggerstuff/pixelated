declare module 'simple-git' {
  interface GitPushOptions {
    '--follow-tags'?: boolean
    '--force'?: boolean
    '--set-upstream'?: boolean
    '--tags'?: boolean
    '--no-verify'?: boolean
  }

  interface GitOptions {
    baseDir?: string
    binary?: string
    maxConcurrentProcesses?: number
    trimmed?: boolean
  }

  interface SimpleGit {
    add: (files: string | string[]) => Promise<void>
    commit: (message: string) => Promise<void>
    push: (
      remote?: string,
      branch?: string,
      options?: GitPushOptions,
    ) => Promise<void>
    // Add other methods as needed
  }

  export function simpleGit(baseDir?: string, options?: GitOptions): SimpleGit
}
