declare module 'mongoose' {
  export interface Document {
    [key: string]: unknown
  }

  export class Schema<_T = unknown> {
    static Types: {
      Mixed: unknown
      ObjectId: unknown
    }

    constructor(definition?: unknown, options?: unknown)
    index(definition: unknown): void
  }

  export interface Connection {
    on(event: string, listener: (...args: unknown[]) => void): void
    close(): Promise<void>
  }

  export interface MongooseStatic {
    connect(uri: string): Promise<void>
    connection: Connection
    model<_T = unknown>(name: string, schema: unknown): unknown
  }

  const mongoose: MongooseStatic
  export default mongoose
}
