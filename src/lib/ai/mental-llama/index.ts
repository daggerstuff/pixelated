import { getHipaaCompliantLogger } from '@/lib/logging/standardized-logger.ts'
import { getEnv } from '../../../config/env.config.ts'

import { MentalLLaMAModelProvider } from './models/MentalLLaMAModelProvider.ts'
import { MentalHealthTaskRouter } from './routing/MentalHealthTaskRouter.ts'
import { MentalLLaMAAdapter } from './adapter/MentalLLaMAAdapter.ts'
import { createMentalLLaMAPythonBridge } from './bridge/server.ts'
import { SlackNotificationService } from '../../services/notification/SlackNotificationService.ts'
import type { ICrisisNotificationHandler } from '../../services/notification/NotificationService.ts'
import type {
  LLMInvoker,
  LLMInvocationOptions,
} from './types/mentalLLaMATypes.ts'

const logger = getHipaaCompliantLogger('general')

export { MentalLLaMAAdapter } from './adapter/MentalLLaMAAdapter.ts'
export { MentalLLaMAModelProvider } from './models/MentalLLaMAModelProvider.ts'
export { MentalHealthTaskRouter } from './routing/MentalHealthTaskRouter.ts'
export { createMentalLLaMAPythonBridge } from './bridge/server.ts'
export * from './types/index.ts' // Export all types with explicit extension

/**
 * Type for Python bridge instances returned by createMentalLLaMAPythonBridge
 */
export type MentalLLaMAPythonBridgeInstance = Awaited<
  ReturnType<typeof createMentalLLaMAPythonBridge>
>

/**
 * Configuration for the MentalLLaMAFactory.
 */
export interface MentalLLaMAFactoryConfig {
  defaultModelTier?: '7B' | '13B' | string
  enablePythonBridge?: boolean
  pythonBridgeScriptPath?: string
  // Potentially add overrides for keyword rules, LLM category maps, etc.
}

// Creates and configures the MentalLLaMA components.
export async function createMentalLLaMAFactory(
  config: MentalLLaMAFactoryConfig = {},
): Promise<{
  adapter: MentalLLaMAAdapter
  modelProvider: MentalLLaMAModelProvider
  taskRouter: MentalHealthTaskRouter
  pythonBridge?: MentalLLaMAPythonBridgeInstance
  crisisNotifier?: ICrisisNotificationHandler
}> {
  logger.info('Creating MentalLLaMA components via factory...', { config })

  const env = getEnv()
  const modelTier =
    config.defaultModelTier || env.MENTALLAMA_DEFAULT_MODEL_TIER || '7B'
  const modelProvider = new MentalLLaMAModelProvider(modelTier)

  // The LLMInvoker for the router needs to return LLMResponse, not string
  // Create an adapter to convert the model provider's string response to LLMResponse format
  const llmInvokerForRouter: LLMInvoker = async (
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: LLMInvocationOptions,
  ) => {
    // Convert LLMInvocationOptions to the format expected by modelProvider.chat
    const chatOptions = options
      ? {
          ...(options.temperature !== undefined
            ? { temperature: options.temperature }
            : {}),
          ...(options.max_tokens !== undefined
            ? { max_tokens: options.max_tokens }
            : {}),
          ...(options.top_p !== undefined ? { top_p: options.top_p } : {}),
          ...(options.frequency_penalty !== undefined
            ? { frequency_penalty: options.frequency_penalty }
            : {}),
          ...(options.presence_penalty !== undefined
            ? { presence_penalty: options.presence_penalty }
            : {}),
          ...(options.stop !== undefined ? { stop: options.stop } : {}),
          ...(options.stream !== undefined ? { stream: options.stream } : {}),
          ...(options.logprobs !== undefined
            ? { logprobs: options.logprobs }
            : {}),
          ...(options.model !== undefined ? { model: options.model } : {}),
          ...(options.timeout !== undefined
            ? { timeout: options.timeout }
            : {}),
          ...(options.retries !== undefined
            ? { retries: options.retries }
            : {}),
          ...options.providerSpecificParams,
        }
      : undefined

    return await modelProvider.invoke(messages, chatOptions)
  }
  const taskRouter = new MentalHealthTaskRouter(llmInvokerForRouter)
  let crisisNotifier: ICrisisNotificationHandler | undefined = undefined
  let pythonBridge: MentalLLaMAPythonBridgeInstance | undefined = undefined
  const slackWebhookUrl = env.SLACK_WEBHOOK_URL
  if (slackWebhookUrl) {
    try {
      crisisNotifier = new SlackNotificationService(slackWebhookUrl)
      logger.info(
        'SlackNotificationService initialized for MentalLLaMAAdapter.',
      )
    } catch (error: unknown) {
      logger.error(
        'Failed to initialize SlackNotificationService for MentalLLaMAAdapter:',
        error,
      )
      // Continue without crisis notifications if Slack setup fails
    }
  } else {
    logger.warn(
      'Slack webhook URL not configured. MentalLLaMAAdapter will operate without Slack crisis notifications.',
    )
  }

  if (config.enablePythonBridge || env.MENTALLAMA_ENABLE_PYTHON_BRIDGE) {
    try {
      pythonBridge = await createMentalLLaMAPythonBridge(
        config.pythonBridgeScriptPath,
      )
      // Initialize the bridge. In a real scenario, you might want to ensure this completes
      // successfully before proceeding or handle failures gracefully.
      await pythonBridge.initialize()
      if (pythonBridge.isReady()) {
        logger.info('MentalLLaMAPythonBridge initialized and ready.')
      } else {
        logger.warn(
          'MentalLLaMAPythonBridge initialization failed or did not complete. Features requiring it may not work.',
        )
        // Optionally set pythonBridge back to undefined if it's not usable
      }
    } catch (error: unknown) {
      logger.error('Failed to initialize MentalLLaMAPythonBridge:', error)
    }
  }

  const adapter = new MentalLLaMAAdapter(
    crisisNotifier
      ? { modelProvider, taskRouter, crisisNotifier }
      : { modelProvider, taskRouter },
  )
  // pythonBridge is not directly part of MentalLLaMAAdapterOptions in the merged version
  // It's used by ExpertGuidanceOrchestrator or other specific components if needed.
  // If the Python bridge is available, one might pass it to the adapter too,
  // or the adapter might use it via the modelProvider if certain models are python-bridge-only.
  // For now, the adapter doesn't directly take the bridge in its constructor.

  logger.info('MentalLLaMA components created successfully.')

  const result: {
    adapter: MentalLLaMAAdapter
    modelProvider: MentalLLaMAModelProvider
    taskRouter: MentalHealthTaskRouter
    pythonBridge?: MentalLLaMAPythonBridgeInstance
    crisisNotifier?: ICrisisNotificationHandler
  } = {
    adapter,
    modelProvider,
    taskRouter,
  }

  if (pythonBridge) {
    result.pythonBridge = pythonBridge
  }

  if (crisisNotifier) {
    result.crisisNotifier = crisisNotifier
  }

  return result
}

/**
 * Convenience method to create MentalLLaMA components using environment configurations.
 */
export async function createMentalLLaMAFactoryFromEnv(): Promise<{
  adapter: MentalLLaMAAdapter
  modelProvider: MentalLLaMAModelProvider
  taskRouter: MentalHealthTaskRouter
  pythonBridge?: MentalLLaMAPythonBridgeInstance
  crisisNotifier?: ICrisisNotificationHandler
}> {
  const env = getEnv()
  const config: MentalLLaMAFactoryConfig = {
    defaultModelTier: env.MENTALLAMA_DEFAULT_MODEL_TIER || '7B',
    enablePythonBridge: env.MENTALLAMA_ENABLE_PYTHON_BRIDGE || false,
  }

  if (env.MENTALLAMA_PYTHON_BRIDGE_SCRIPT_PATH) {
    config.pythonBridgeScriptPath = env.MENTALLAMA_PYTHON_BRIDGE_SCRIPT_PATH
  }

  return createMentalLLaMAFactory(config)
}

/**
 * Creates and initializes a MentalLLaMA instance from environment configuration.
 * This function serves as the main entry point for creating MentalLLaMA components.
 * This is a convenience wrapper around MentalLLaMAFactory.createFromEnv().
 *
 * @returns Promise containing the initialized adapter and model provider
 */
export async function createMentalLLaMAFromEnv(): Promise<{
  adapter: MentalLLaMAAdapter
  modelProvider: MentalLLaMAModelProvider
}> {
  logger.info(
    'Creating MentalLLaMA components from environment configuration...',
  )

  try {
    const result = await createMentalLLaMAFactoryFromEnv()

    logger.info('MentalLLaMA components created successfully', {
      hasModelProvider: !!result.modelProvider,
      hasTaskRouter: !!result.taskRouter,
      hasCrisisNotifier: !!result.crisisNotifier,
      hasPythonBridge: !!result.pythonBridge,
    })

    return {
      adapter: result.adapter,
      modelProvider: result.modelProvider,
    }
  } catch (error: unknown) {
    logger.error('Failed to create MentalLLaMA components', { error })
    throw error
  }
}

export default {
  createMentalLLaMAFactory,
  createMentalLLaMAFactoryFromEnv,
}
