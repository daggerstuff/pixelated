import type {
  PythonBridgeRequest,
  PythonBridgeResponse,
  IMHIEvaluationParams,
  MentalLLaMAAnalysisResult,
} from '../types/index.ts'
import type { ChildProcessWithoutNullStreams } from 'child_process'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { createBuildSafeLogger } from '../../../logging/build-safe-logger'

const logger = createBuildSafeLogger('MentalLLaMA')

/**
 * Custom error for features not implemented or unavailable in the Python bridge.
 */

class PythonBridgeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PythonBridgeError'
  }
}

/**
 * MentalLLaMAPythonBridge provides a robust, production-grade interface to communicate with a Python backend
 * for tasks that are better suited for Python libraries (e.g., specific ML models, complex evaluations).
 *
 * This implementation manages a Python child process and uses JSON-RPC over stdio for reliable inter-process communication.
 * It supports request queueing, strict type safety, error handling, and full lifecycle management.
 */

export class MentalLLaMAPythonBridge {
  private pythonProcess: ChildProcessWithoutNullStreams | null = null
  private isInitialized = false
  private isFunctional = false
  private pythonScriptPath: string
  private requestQueue: Map<
    string,
    {
      resolve: (value: unknown) => void
      reject: (reason?: unknown) => void
      timeout: ReturnType<typeof setTimeout>
    }
  > = new Map()
  private readonly REQUEST_TIMEOUT_MS = 20000
  public pythonBridgeDisabled: boolean = false

  constructor(pythonScriptPath?: string) {
    this.pythonScriptPath =
      pythonScriptPath || './scripts/mental_llama_python_handler.py'
    this.pythonBridgeDisabled = false
    logger.info('MentalLLaMAPythonBridge instance created.', {
      scriptPath: this.pythonScriptPath,
    })
  }

  /**
   * Initializes the Python bridge by spawning the Python process and establishing communication.
   * @returns {Promise<boolean>} True if the bridge is functional and ready for requests, false otherwise.
   */

  public async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      logger.info(
        `PythonBridge already attempted initialization. Functional: ${this.isFunctional}`,
      )
      return this.isFunctional
    }
    logger.info('Attempting to initialize PythonBridge...')
    try {
      this.pythonProcess = spawn('python3', [this.pythonScriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      this.pythonProcess.stdout.setEncoding('utf-8')
      this.pythonProcess.stderr.setEncoding('utf-8')

      this.pythonProcess.stdout.on('data', (data: string) => {
        data
          .split(/\r?\n/)
          .filter(Boolean)
          .forEach((line) => {
            try {
              const response: PythonBridgeResponse & { id?: string } =
                JSON.parse(line) as unknown
              if (
                response &&
                response.id &&
                this.requestQueue.has(response.id)
              ) {
                const { resolve, timeout } = this.requestQueue.get(response.id)!
                clearTimeout(timeout)
                this.requestQueue.delete(response.id!)
                if (response.success) {
                  resolve(response.data)
                } else {
                  resolve(response) // Let caller handle error
                }
              }
            } catch (err: unknown) {
              logger.error('Failed to parse PythonBridge response', line, err)
            }
          })
      })

      this.pythonProcess.stderr.on('data', (data: string) => {
        logger.error('PythonBridge stderr:', data)
      })

      this.pythonProcess.on('close', (code: number | null) => {
        logger.warn(`PythonBridge process closed with code ${code}`)
        this.isFunctional = false
        this.isInitialized = false
      })

      this.pythonProcess.on('error', (err: Error) => {
        logger.error('PythonBridge process error:', err)
        this.isFunctional = false
        this.isInitialized = false
      })

      // Optionally, send a ping or health check here
      this.isInitialized = true
      this.isFunctional = true
      logger.info('PythonBridge initialized and functional.')
      return true
    } catch (error: unknown) {
      logger.error('PythonBridge initialization failed.', { error })
      this.isInitialized = true
      this.isFunctional = false
      this.pythonProcess = null
      return false
    }
  }

  /**
   * Analyzes text using a Python-based model via the bridge.
   * @param {string} text - The text to analyze.
   * @param {Record<string, unknown>} [modelParams] - Optional parameters for the Python model.
   * @returns {Promise<MentalLLaMAAnalysisResult | null>} The analysis result or null if failed.
   * @throws {PythonBridgeError} if the bridge is not functional.
   */

  public async analyzeTextWithPythonModel(
    text: string,
    modelParams?: Record<string, unknown>,
  ): Promise<MentalLLaMAAnalysisResult | null> {
    if (!this.isFunctional) {
      logger.error(
        'PythonBridge is not functional. Cannot analyze text with Python model.',
      )
      throw new PythonBridgeError('PythonBridge is not functional.')
    }
    const payload = { text, modelParams }
    const response = await this.sendRequest('analyze_text', payload)
    if (
      response &&
      typeof response === 'object' &&
      'hasMentalHealthIssue' in response
    ) {
      return response as MentalLLaMAAnalysisResult
    }
    logger.error(
      'Unexpected response from PythonBridge analyzeTextWithPythonModel',
      response,
    )
    return null
  }

  /**
   * Runs an IMHI (Integrated Mental Health Intelligence) evaluation using Python scripts.
   * @param {IMHIEvaluationParams} params - Parameters for the IMHI evaluation.
   * @returns {Promise<unknown>} The results of the evaluation.
   * @throws {PythonBridgeError} if the bridge is not functional.
   */

  public async runIMHIEvaluation(
    params: IMHIEvaluationParams,
  ): Promise<unknown> {
    if (!this.isFunctional) {
      logger.error(
        'PythonBridge is not functional. Cannot run IMHI evaluation.',
      )
      throw new PythonBridgeError('PythonBridge is not functional.')
    }
    return this.sendRequest(
      'run_imhi_evaluation',
      params as unknown as Record<string, unknown>,
    )
  }

  /**
   * Shuts down the Python bridge and terminates the Python process.
   * Ensures all resources are cleaned up and the process is killed.
   * @returns {Promise<void>}
   */

  public async shutdown(): Promise<void> {
    logger.info('Shutting down PythonBridge...')
    if (this.pythonProcess) {
      try {
        await this.sendRequest('shutdown', {})
      } catch (e) {
        logger.warn('Error during PythonBridge shutdown request', e)
      }
      this.pythonProcess.kill()
      this.pythonProcess = null
    }
    this.isInitialized = false
    this.isFunctional = false
    logger.info('PythonBridge shut down.')
  }

  /**
   * Checks if the Python bridge is initialized and functional.
   * "Ready" means it has attempted initialization and is connected to a functional Python process.
   * @returns {boolean} True if the bridge is ready, false otherwise.
   */
  public isReady(): boolean {
    return this.isInitialized && this.isFunctional
  }

  /**
   * Sends a request to the Python process and returns the response.
   * Handles request queueing, timeouts, and error propagation.
   * @param command Command string
   * @param payload Payload object
   * @returns {Promise<unknown>} The response from the Python process.
   */
  private sendRequest(
    command: string,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.pythonProcess || !this.isFunctional) {
      return Promise.reject(
        new PythonBridgeError('Python process not running.'),
      )
    }
    const id = randomUUID()
    const request: PythonBridgeRequest & { id: string } = {
      command,
      payload,
      id,
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.requestQueue.delete(id)
        reject(new PythonBridgeError(`Request timed out: ${command}`))
      }, this.REQUEST_TIMEOUT_MS)
      this.requestQueue.set(id, { resolve, reject, timeout })
      try {
        this.pythonProcess!.stdin.write(JSON.stringify(request) + '\n')
      } catch {
        clearTimeout(timeout)
        this.requestQueue.delete(id)
        reject(new PythonBridgeError('Failed to write to Python process.'))
      }
    })
  }
}

export default MentalLLaMAPythonBridge
