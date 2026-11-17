import { getHipaaCompliantLogger } from '@/lib/logging/standardized-logger.ts'

import { getEnv } from '../../../config/env.config.ts'
import type { ICrisisNotificationHandler } from '../../services/notification/NotificationService.ts'
import { SlackNotificationService } from '../../services/notification/SlackNotificationService.ts'
import { MentalHealthAIAdapter } from './adapter/MentalHealthAIAdapter.ts'
import { createMentalHealthAIPythonBridge } from './bridge/server.ts'
import { MentalHealthAIModelProvider } from './models/MentalHealthAIModelProvider.ts'
import { MentalHealthTaskRouter } from './routing/MentalHealthTaskRouter.ts'
import type {
  LLMInvoker,
  LLMInvocationOptions,
  MentalHealthAIAdapterOptions,
} from './types/mentalHealthAITypes.ts'

const logger = getHipaaCompliantLogger('general')

export { MentalHealthAIAdapter } from './adapter/MentalHealthAIAdapter.ts'
export { MentalHealthAIModelProvider } from './models/MentalHealthAIModelProvider.ts'
export * from './types/index.ts' // Export all types with explicit extension

/**
 * Type for Python bridge instances returned by createMentalHealthAIPythonBridge
 */
type MentalHealthAIPythonBridgeInstance = Awaited<
  ReturnType<typeof createMentalHealthAIPythonBridge>
>

/**
 * Configuration for the MentalHealthAIFactory.
 */
interface MentalHealthAIFactoryConfig {
  defaultModelTier?: '7B' | '13B'
  enablePythonBridge?: boolean
  pythonBridgeScriptPath?: string
  // Potentially add overrides for keyword rules, LLM category maps, etc.
}

// Creates and configures the MentalHealthAI components.
async function createMentalHealthAIFactory(
  config: MentalHealthAIFactoryConfig = {},
): Promise<{
  adapter: MentalHealthAIAdapter
  modelProvider: MentalHealthAIModelProvider
  taskRouter: MentalHealthTaskRouter
  pythonBridge?: MentalHealthAIPythonBridgeInstance
  crisisNotifier?: ICrisisNotificationHandler
}> {
  logger.info('Creating MentalHealthAI components via factory...', { config })

  const env = getEnv()
  const modelTier =
    (config.defaultModelTier ?? env.MENTAL_HEALTH_AI_DEFAULT_MODEL_TIER) ?? '7B'
  const modelProvider = new MentalHealthAIModelProvider(modelTier)

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
  let pythonBridge: MentalHealthAIPythonBridgeInstance | undefined = undefined
  const slackWebhookUrl = env.SLACK_WEBHOOK_URL
  if (slackWebhookUrl) {
    try {
      crisisNotifier = new SlackNotificationService(slackWebhookUrl)
      logger.info(
        'SlackNotificationService initialized for MentalHealthAIAdapter.',
      )
    } catch (error: unknown) {
      logger.error(
        'Failed to initialize SlackNotificationService for MentalHealthAIAdapter:',
        error,
      )
      // Continue without crisis notifications if Slack setup fails
    }
  } else {
    logger.warn(
      'Slack webhook URL not configured. MentalHealthAIAdapter will operate without Slack crisis notifications.',
    )
  }

  if (config.enablePythonBridge || env.MENTAL_HEALTH_AI_ENABLE_PYTHON_BRIDGE) {
    try {
      pythonBridge = await createMentalHealthAIPythonBridge(
        config.pythonBridgeScriptPath,
      )
      // Initialize the bridge. In a real scenario, you might want to ensure this completes
      // successfully before proceeding or handle failures gracefully.
      await pythonBridge.initialize()
      if (pythonBridge.isReady()) {
        logger.info('MentalHealthAIPythonBridge initialized and ready.')
      } else {
        logger.warn(
          'MentalHealthAIPythonBridge initialization failed or did not complete. Features requiring it may not work.',
        )
        // Optionally set pythonBridge back to undefined if it's not usable
      }
    } catch (error: unknown) {
      logger.error('Failed to initialize MentalHealthAIPythonBridge:', error)
    }
  }

  const adapterOptions: MentalHealthAIAdapterOptions = { modelProvider, taskRouter }
  if (crisisNotifier) {
    adapterOptions.crisisNotifier = crisisNotifier as unknown
  }
  const adapter = new MentalHealthAIAdapter(adapterOptions)
  // pythonBridge is not directly part of MentalHealthAIAdapterOptions in the merged version
  // It's used by ExpertGuidanceOrchestrator or other specific components if needed.
  // If the Python bridge is available, one might pass it to the adapter too,
  // or the adapter might use it via the modelProvider if certain models are python-bridge-only.
  // For now, the adapter doesn't directly take the bridge in its constructor.

  logger.info('MentalHealthAI components created successfully.')

  const result: {
    adapter: MentalHealthAIAdapter
    modelProvider: MentalHealthAIModelProvider
    taskRouter: MentalHealthTaskRouter
    pythonBridge?: MentalHealthAIPythonBridgeInstance
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
 * Convenience method to create MentalHealthAI components using environment configurations.
 */
async function createMentalHealthAIFactoryFromEnv(): Promise<{
  adapter: MentalHealthAIAdapter
  modelProvider: MentalHealthAIModelProvider
  taskRouter: MentalHealthTaskRouter
  pythonBridge?: MentalHealthAIPythonBridgeInstance
  crisisNotifier?: ICrisisNotificationHandler
}> {
  const env = getEnv()
  const config: MentalHealthAIFactoryConfig = {
    defaultModelTier: env.MENTAL_HEALTH_AI_DEFAULT_MODEL_TIER ?? '7B',
    enablePythonBridge: env.MENTAL_HEALTH_AI_ENABLE_PYTHON_BRIDGE ?? false,
  }

  if (env.MENTAL_HEALTH_AI_PYTHON_BRIDGE_SCRIPT_PATH) {
    config.pythonBridgeScriptPath = env.MENTAL_HEALTH_AI_PYTHON_BRIDGE_SCRIPT_PATH
  }

  return createMentalHealthAIFactory(config)
}

/**
 * Creates and initializes a MentalHealthAI instance from environment configuration.
 * This function serves as the main entry point for creating MentalHealthAI components.
 * This is a convenience wrapper around MentalHealthAIFactory.createFromEnv().
 *
 * @returns Promise containing the initialized adapter and model provider
 */
export async function createMentalHealthAIFromEnv(): Promise<{
  adapter: MentalHealthAIAdapter
  modelProvider: MentalHealthAIModelProvider
}> {
  logger.info(
    'Creating MentalHealthAI components from environment configuration...',
  )

  try {
    const result = await createMentalHealthAIFactoryFromEnv()

    logger.info('MentalHealthAI components created successfully', {
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
    logger.error('Failed to create MentalHealthAI components', { error })
    throw error
  }
}
