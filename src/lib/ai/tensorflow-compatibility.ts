/**
 * TensorFlow.js Compatibility Layer
 * Provides compatibility between Node.js 24+ and TensorFlow.js
 * Falls back to browser version when Node.js version is incompatible
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('tensorflow-compatibility')

export interface TensorFlowCompatibility {
  isNodeCompatible: boolean
  tf: any
  loadLayersModel: any
  sequential: any
  layers: any
  train: any
}

class TensorFlowCompatibilityImpl implements TensorFlowCompatibility {
  private _tf: any = null
  private _loadLayersModel: any = null
  private _isNodeCompatible: boolean = false

  constructor() {
    this.initializeTensorFlow()
  }

  get isNodeCompatible(): boolean {
    return this._isNodeCompatible
  }

  get tf(): any {
    return this._tf
  }

  get loadLayersModel(): any {
    return this._loadLayersModel
  }

  get sequential(): any {
    return this._tf?.sequential
  }

  get layers(): any {
    return this._tf?.layers
  }

  get train(): any {
    return this._tf?.train
  }

  private async initializeTensorFlow(): Promise<void> {
    try {
      // Try to use Node.js version first
      try {
        const nodeVersion = process.version
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0])

        // Node.js 24+ has compatibility issues with tfjs-node
        if (majorVersion >= 24) {
          logger.info(
            'Node.js 24+ detected, using browser version of TensorFlow.js',
          )
          await this.loadBrowserVersion()
          return
        }

        // Try to load Node.js version for older Node.js versions
        const tfNode = await import('@tensorflow/tfjs-node')
        this._tf = tfNode
        this._loadLayersModel = tfNode.loadLayersModel
        this._isNodeCompatible = true
        logger.info('TensorFlow.js Node.js version loaded successfully')
      } catch (nodeError) {
        logger.warn(
          'Failed to load TensorFlow.js Node.js version, falling back to browser version',
          { error: nodeError },
        )
        await this.loadBrowserVersion()
      }
    } catch (error) {
      logger.error('Failed to initialize TensorFlow.js compatibility layer', {
        error,
      })
      throw new Error('TensorFlow.js initialization failed', { cause: error })
    }
  }

  private async loadBrowserVersion(): Promise<void> {
    try {
      // Load browser version for Node.js 24+ compatibility
      const tfBrowser = await import('@tensorflow/tfjs')
      this._tf = tfBrowser
      this._loadLayersModel = tfBrowser.loadLayersModel
      this._isNodeCompatible = false
      logger.info('TensorFlow.js browser version loaded successfully')
    } catch (browserError) {
      logger.error('Failed to load TensorFlow.js browser version', {
        error: browserError,
      })
      throw new Error('TensorFlow.js browser version failed to load', { cause: browserError })
    }
  }

  async dispose(): Promise<void> {
    try {
      if (this._tf && this._tf.dispose) {
        this._tf.dispose()
      }
    } catch (error) {
      logger.error('Error disposing TensorFlow.js resources', { error })
    }
  }
}

// Create singleton instance
let tensorflowInstance: TensorFlowCompatibilityImpl | null = null

export function getTensorFlowCompatibility(): TensorFlowCompatibility {
  if (!tensorflowInstance) {
    tensorflowInstance = new TensorFlowCompatibilityImpl()
  }
  return tensorflowInstance
}

export async function initializeTensorFlowCompatibility(): Promise<void> {
  if (!tensorflowInstance) {
    tensorflowInstance = new TensorFlowCompatibilityImpl()
  }
  // Wait for initialization to complete
  await new Promise((resolve) => setTimeout(resolve, 100))
}

export function disposeTensorFlowCompatibility(): Promise<void> {
  if (tensorflowInstance) {
    return tensorflowInstance.dispose()
  }
  return Promise.resolve()
}
