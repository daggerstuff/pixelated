// Type declarations for digest-fetch (no official types available)
declare module 'digest-fetch' {
  export default class DigestFetch {
    constructor(username: string, password: string)
    fetch(url: string, options?: RequestInit): Promise<Response>
  }
}
