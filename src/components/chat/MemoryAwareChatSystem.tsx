import { useState, useEffect } from 'react'
import { useChatWithMemory } from '@/hooks/useChatWithMemory'
import { useAuth } from '@/hooks/useAuth'
import { ChatContainer } from './ChatContainer'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Brain,
  History,
  BarChart3,
  RefreshCw,
  Trash2,
  Download,
  Settings,
  Info,
  MessageSquare,
  Lightbulb,
} from 'lucide-react'

import type { Message } from '@/types/chat'

interface MemoryAwareChatSystemProps {
  className?: string
  sessionId?: string
  title?: string
  subtitle?: string
  enableMemoryToggle?: boolean
  showMemoryStats?: boolean
  showMemoryInsights?: boolean
}

export function MemoryAwareChatSystem({
  className,
  sessionId,
  title = 'AI Assistant with Memory',
  subtitle = 'Chat with an AI that learns and remembers your conversations',
  // _placeholder is intentionally unused to suppress lint warning
  enableMemoryToggle = true,
  showMemoryStats = true,
  showMemoryInsights = true,
}: MemoryAwareChatSystemProps) {
  const { user } = useAuth()
  const [enableMemory, setEnableMemory] = useState(true)
  const [enableAnalysis, setEnableAnalysis] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [conversationSummary, setConversationSummary] = useState<string>('')

  const chatHook = useChatWithMemory({
    sessionId: sessionId as string,
    enableMemory,
    enableAnalysis,
    maxMemoryContext: 15,
  })

  const {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    regenerateResponse,
    getConversationSummary,
    memoryStats,
  } = useChatWithMemory({
    sessionId,
    enableMemory,
    enableAnalysis,
    maxMemoryContext: 15,
  })

  const getConversationSummary = async () => {
    // This is a placeholder. In a real implementation, you might call an API.
    const summary = `This has been a productive conversation about ${
      memory.stats?.totalMemories
    } topics.`;
    return summary;
  };
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">
                This Session
              </div>
            </div>
        messages: messages.map((msg: Message) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          analyzed: msg.analyzed,
          memoryStored: msg.memoryStored,
          )}
        </CardContent>
      </Card>
    )
  }

  const renderConversationInsights = () => {
        messages: messages.map((msg: Message) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          analyzed: msg.analyzed,
          memoryStored: msg.memoryStored,
          </p>
        </CardContent>
      </Card>
    )
  }

  const renderSettings = () => {
    if (!showSettings) {
      return null
    }

    return (
      <Card className="border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Memory Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {enableMemoryToggle && (
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="memory-toggle" className="text-sm font-medium">
                  Enable Memory
                </Label>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Allow AI to remember and learn from conversations
                </p>
              </div>
              <Switch
                id="memory-toggle"
                checked={enableMemory}
                onCheckedChange={setEnableMemory}
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label
                htmlFor="analysis-toggle"
                className="text-sm font-medium"
              >
                Enable Analysis
              </Label>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Analyze messages for emotions and topics
              </p>
            </div>
            <Switch
              id="analysis-toggle"
              checked={enableAnalysis}
              onCheckedChange={setEnableAnalysis}
            />
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderActionButtons = () => (
    <div className="flex flex-wrap gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-1"
            >
              <Settings className="h-3 w-3" />
              Settings
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Configure memory and analysis settings
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={regenerateResponse}
              disabled={isLoading || messages.length < 2}
              className="flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Regenerate
            </Button>
          </TooltipTrigger>
          <TooltipContent>Regenerate the last AI response</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportConversation}
              disabled={messages.length === 0}
              className="flex items-center gap-1"
            >
              <Download className="h-3 w-3" />
              Export
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export conversation data</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={clearMessages}
              disabled={messages.length === 0}
              className="flex items-center gap-1 text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear all messages</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )

  const renderMemoryIndicators = () => {
    if (!enableMemory) return null

    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        {messages.filter((m) => m?.['memoryStored']).length > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Messages stored in memory</span>
          </div>
        )}
        {enableAnalysis && (
          <div className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3" />
            <span>Analysis enabled</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full space-y-4', className)}>
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {subtitle}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                User: {String(user.name || user.email)}
              </div>
            )}
            <Brain className="h-5 w-5 text-blue-600" />
          </div>
        </div>

        {renderMemoryIndicators()}
        {renderActionButtons()}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <Info className="h-4 w-4" />
            <span className="text-sm font-medium">Error</span>
          </div>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
        </div>
      )}

      {/* Side Panels */}
      <div className="flex gap-4 h-full">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-h-0">
          <ChatContainer
            messages={messages.map((msg: Message) => ({
              role: msg.role,
              content: msg.content,
              name: msg.name,
            }))}
            onSendMessage={sendMessage}
            isLoading={isLoading}
            className="h-full"
          />
        </div>

        {/* Right Sidebar */}
        <div className="w-80 space-y-4 overflow-y-auto">
          {renderMemoryStats()}
          {renderConversationInsights()}
          {renderSettings()}

          {/* Info Panel */}
          <Card className="border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Info className="h-4 w-4" />
                How Memory Works
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-gray-600 dark:text-gray-400 space-y-2">
              <div className="flex items-start gap-2">
                <MessageSquare className="h-3 w-3 mt-1 flex-shrink-0" />
                <span>
                  Messages are analyzed and stored with emotional context
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Brain className="h-3 w-3 mt-1 flex-shrink-0" />
                <span>
                  AI retrieves relevant memories to personalize responses
                </span>
              </div>
              <div className="flex items-start gap-2">
                <History className="h-3 w-3 mt-1 flex-shrink-0" />
                <span>
                  Conversation patterns help improve future interactions
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default MemoryAwareChatSystem
