// Simple logger implementation without external dependencies
export const logger = {
  info: (message: string, ...args: unknown[]) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args)
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args)
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args)
  },
  debug: (message: string, ...args: unknown[]) => {
    if (process.env['NODE_ENV'] !== 'production') {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args)
    }
  },
}

export class Logger {
  private context: string

  constructor(context: string) {
    this.context = context
  }

  info(message: string, data?: any): void {
    logger.info(`[${this.context}] ${message}`, data)
  }

  warn(message: string, data?: any): void {
    logger.warn(`[${this.context}] ${message}`, data)
  }

  error(message: string, data?: any): void {
    logger.error(`[${this.context}] ${message}`, data)
  }

  debug(message: string, data?: any): void {
    logger.debug(`[${this.context}] ${message}`, data)
  }
}
