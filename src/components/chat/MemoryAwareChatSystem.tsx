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
import { useState, useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  useChatWithMemory,
  UseChatWithMemoryReturn,
} from '@/hooks/useChatWithMemory'
import { authClient } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import type { Message } from '@/types/chat'

import { ChatContainer } from './ChatContainer'

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
      void Promise.resolve(getConversationSummary()).then(setConversationSummary)
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
      <Card className='border-blue-200 dark:border-blue-800'>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-sm font-medium'>
            <Brain className='text-blue-600 h-4 w-4' />
            Memory Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='grid grid-cols-3 gap-3 text-sm'>
            <div className='bg-blue-50 dark:bg-blue-950/20 rounded p-2 text-center'>
              <div className='text-blue-700 dark:text-blue-300 font-semibold'>
                {memory.stats?.totalMemories || 0}
              </div>
              <div className='text-blue-600 dark:text-blue-400 text-xs'>
                Total Memories
              </div>
            </div>
            <div className='bg-green-50 dark:bg-green-950/20 rounded p-2 text-center'>
              <div className='text-green-700 dark:text-green-300 font-semibold'>
                {memory.memories.length}
              </div>
              <div className='text-green-600 dark:text-green-400 text-xs'>
                This Session
              </div>
            </div>
            <div className='bg-purple-50 dark:bg-purple-950/20 rounded p-2 text-center'>
              <div className='text-purple-700 dark:text-purple-300 font-semibold'>
                {/* Context Used: Not available in MemoryStats, so remove or replace */}
                N/A
              </div>
              <div className='text-purple-600 dark:text-purple-400 text-xs'>
                Context Used
              </div>
            </div>
          </div>

          {enableMemory && (
            <div className='text-gray-600 dark:text-gray-400 flex items-center gap-2 text-xs'>
              <Brain className='h-3 w-3' />
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
      <Card className='border-amber-200 dark:border-amber-800'>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-sm font-medium'>
            <Lightbulb className='text-amber-600 h-4 w-4' />
            Conversation Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-gray-700 dark:text-gray-300 text-sm'>
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
      <Card className='border-gray-200 dark:border-gray-700'>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-sm font-medium'>
            <Settings className='h-4 w-4' />
            Memory Settings
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          {enableMemoryToggle && (
            <div className='flex items-center justify-between'>
              <div className='space-y-1'>
                <Label htmlFor='memory-toggle' className='text-sm font-medium'>
                  Enable Memory
                </Label>
                <p className='text-gray-600 dark:text-gray-400 text-xs'>
                  Allow AI to remember and learn from conversations
                </p>
              </div>
              <Switch
                id='memory-toggle'
                checked={enableMemory}
                onCheckedChange={setEnableMemory}
              />
            </div>
          )}

          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <Label htmlFor='analysis-toggle' className='text-sm font-medium'>
                Enable Analysis
              </Label>
              <p className='text-gray-600 dark:text-gray-400 text-xs'>
                Analyze messages for emotions and topics
              </p>
            </div>
            <Switch
              id='analysis-toggle'
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
      void sendMessage('Please regenerate the last response.')
    }
  }

  const handleClear = () => {
    // This is a placeholder.
    // In a real implementation, you might want to confirm with the user.
    memory.clearMemories()
  }

  const renderActionButtons = () => (
    <div className='flex flex-wrap gap-2'>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setShowSettings(!showSettings)}
              className='flex items-center gap-1'
            >
              <Settings className='h-3 w-3' />
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
              variant='outline'
              size='sm'
              onClick={handleRegenerate}
              disabled={isLoading || messages.length < 2}
              className='flex items-center gap-1'
            >
              <RefreshCw className='h-3 w-3' />
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
              variant='outline'
              size='sm'
              onClick={handleExportConversation}
              disabled={messages.length === 0}
              className='flex items-center gap-1'
            >
              <Download className='h-3 w-3' />
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
              variant='outline'
              size='sm'
              onClick={handleClear}
              disabled={messages.length === 0}
              className='text-red-600 hover:text-red-700 flex items-center gap-1'
            >
              <Trash2 className='h-3 w-3' />
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
      <div className='text-gray-500 dark:text-gray-400 flex items-center gap-2 text-xs'>
        {messages.filter((m) => m.role === 'assistant').length > 0 && (
          <div className='flex items-center gap-1'>
            <div className='bg-green-500 h-2 w-2 animate-pulse rounded-full' />
            <span>Messages stored in memory</span>
          </div>
        )}
        {enableAnalysis && (
          <div className='flex items-center gap-1'>
            <BarChart3 className='h-3 w-3' />
            <span>Analysis enabled</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full space-y-4', className)}>
      {/* Header */}
      <div className='space-y-2'>
        <div className='flex items-center justify-between'>
          <div>
            <h2 className='text-gray-900 dark:text-gray-100 text-xl font-semibold'>
              {title}
            </h2>
            <p className='text-gray-600 dark:text-gray-400 text-sm'>
              {subtitle}
            </p>
          </div>
          <div className='flex items-center gap-2'>
            {user && (
              <div className='text-gray-500 dark:text-gray-400 text-xs'>
                User: {String(user.fullName || user.email)}
              </div>
            )}
            <Brain className='text-blue-600 h-5 w-5' />
          </div>
        </div>

        {renderMemoryIndicators()}
        {renderActionButtons()}
      </div>

      {/* Error Display */}
      {memory.error && (
        <div className='bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 rounded-lg border p-3'>
          <div className='text-red-700 dark:text-red-300 flex items-center gap-2'>
            <Info className='h-4 w-4' />
            <span className='text-sm font-medium'>Error</span>
          </div>
          <p className='text-red-600 dark:text-red-400 mt-1 text-sm'>
            {memory.error.toString()}
          </p>
        </div>
      )}

      {/* Side Panels */}
      <div className='flex h-full gap-4'>
        {/* Main Chat Area */}
        <div className='flex min-h-0 flex-1 flex-col'>
          <ChatContainer
            messages={messages.map((msg: Message) => ({
              role: msg.role,
              content: msg.content,
              name: msg.name,
            }))}
            onSendMessage={sendMessage}
            isLoading={isLoading}
            className='h-full'
          />
        </div>

        {/* Right Sidebar */}
        <div className='w-80 space-y-4 overflow-y-auto'>
          {renderMemoryStats()}
          {renderConversationInsights()}
          {renderSettings()}

          {/* Info Panel */}
          <Card className='border-gray-200 dark:border-gray-700'>
            <CardHeader className='pb-3'>
              <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                <Info className='h-4 w-4' />
                How Memory Works
              </CardTitle>
            </CardHeader>
            <CardContent className='text-gray-600 dark:text-gray-400 space-y-2 text-xs'>
              <div className='flex items-start gap-2'>
                <MessageSquare className='mt-1 h-3 w-3 flex-shrink-0' />
                <span>
                  Messages are analyzed and stored with emotional context
                </span>
              </div>
              <div className='flex items-start gap-2'>
                <Brain className='mt-1 h-3 w-3 flex-shrink-0' />
                <span>
                  AI retrieves relevant memories to personalize responses
                </span>
              </div>
              <div className='flex items-start gap-2'>
                <History className='mt-1 h-3 w-3 flex-shrink-0' />
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
