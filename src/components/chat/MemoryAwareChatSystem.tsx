import { useState, useEffect } from 'react'
import {
  useChatWithMemory,
  UseChatWithMemoryReturn,
} from '@/hooks/useChatWithMemory'
import { authClient } from '@/lib/auth-client'
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
  enableMemoryToggle = true,
  showMemoryStats = true,
  showMemoryInsights = true,
}: MemoryAwareChatSystemProps) {
  const { data: session } = authClient.useSession()
  const user = session?.user
  const [enableMemory, setEnableMemory] = useState(true)
  const [enableAnalysis, setEnableAnalysis] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [conversationSummary, setConversationSummary] = useState<string>('')

  const { messages, isLoading, sendMessage, memory }: UseChatWithMemoryReturn =
    useChatWithMemory({
      sessionId: sessionId as string,
      enableMemory,
      enableAnalysis,
      maxMemoryContext: 15,
      api: '/api/mental-health/chat', // Use the actual therapeutic AI endpoint
    })

  const getConversationSummary = async () => {
    // This is a placeholder. In a real implementation, you might call an API.
    return `This has been a productive conversation about ${
      memory.stats?.totalMemories
    } topics.`
  }

  // Generate conversation summary when messages change
  useEffect(() => {
    if (messages.length > 4) {
      Promise.resolve(getConversationSummary()).then(setConversationSummary)
    }
  }, [messages])

  const handleExportConversation = async () => {
    try {
      const summary = await getConversationSummary()
      const exportData = {
        timestamp: new Date().toISOString(),
        sessionId,
        userId: user?.id,
        summary,
        messageCount: messages.length,
        memoryStats: memory.stats,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `conversation-${sessionId}-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      console.error('Failed to export conversation:', err)
    }
  }

  const renderMemoryStats = () => {
    if (!showMemoryStats) {
      return null
    }

    return (
      <Card className="border-blue-200 dark:border-blue-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="h-4 w-4 text-blue-600" />
            Memory Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="text-center p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
              <div className="font-semibold text-blue-700 dark:text-blue-300">
                {memory.stats?.totalMemories || 0}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">
                Total Memories
              </div>
            </div>
            <div className="text-center p-2 bg-green-50 dark:bg-green-950/20 rounded">
              <div className="font-semibold text-green-700 dark:text-green-300">
                {memory.memories.length}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">
                This Session
              </div>
            </div>
            <div className="text-center p-2 bg-purple-50 dark:bg-purple-950/20 rounded">
              <div className="font-semibold text-purple-700 dark:text-purple-300">
                {/* Context Used: Not available in MemoryStats, so remove or replace */}
                N/A
              </div>
              <div className="text-xs text-purple-600 dark:text-purple-400">
                Context Used
              </div>
            </div>
          </div>

          {enableMemory && (
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <Brain className="h-3 w-3" />
              AI is using conversation memory for personalized responses
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderConversationInsights = () => {
    if (!showMemoryInsights || !conversationSummary) {
      return null
    }

    return (
      <Card className="border-amber-200 dark:border-amber-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-600" />
            Conversation Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {conversationSummary}
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
              <Label htmlFor="analysis-toggle" className="text-sm font-medium">
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

  const handleRegenerate = () => {
    // This is a placeholder. A real implementation would be more complex.
    if (messages.length > 0) {
      sendMessage('Please regenerate the last response.')
    }
  }

  const handleClear = () => {
    // This is a placeholder.
    // In a real implementation, you might want to confirm with the user.
    memory.clearMemories()
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
              onClick={handleRegenerate}
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
              onClick={handleClear}
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
    if (!enableMemory) {
      return null
    }

    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        {messages.filter((m) => m.role === 'assistant').length > 0 && (
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
      {memory.error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <Info className="h-4 w-4" />
            <span className="text-sm font-medium">Error</span>
          </div>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            {memory.error.toString()}
          </p>
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
