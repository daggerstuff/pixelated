import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { 
  Send, 
  Brain, 
  Heart, 
  Zap, 
  User, 
  Bot, 
  Activity,
  AlertTriangle,
  Shield,
  Sparkles
} from 'lucide-react'
import MindMirrorDashboard, { type MindMirrorAnalysis } from './MindMirrorDashboard'
import BrainVisualization from './BrainVisualization'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
  analysis?: MindMirrorAnalysis
}

interface EnhancedMentalHealthChatProps {
  onAnalyze?: (text: string) => Promise<MindMirrorAnalysis>
  className?: string
  showBrainViz?: boolean
  showAnalysisPanel?: boolean
}

// Mock analysis function for demo purposes
const mockAnalyze = async (text: string): Promise<MindMirrorAnalysis> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500))
  
  // Simple keyword-based analysis for demo
  const words = text.toLowerCase()
  
  let archetype = "visionary"
  let confidence = 0.75
  
  if (words.includes("hurt") || words.includes("pain") || words.includes("heal")) {
    archetype = "wounded_healer"
    confidence = 0.85
  } else if (words.includes("plan") || words.includes("strategy") || words.includes("control")) {
    archetype = "shadow_strategist"
    confidence = 0.80
  } else if (words.includes("dream") || words.includes("future") || words.includes("create")) {
    archetype = "visionary"
    confidence = 0.82
  } else if (words.includes("care") || words.includes("help") || words.includes("support")) {
    archetype = "caregiver"
    confidence = 0.78
  }

  const emotional_intensity = Math.min(0.9, (words.match(/feel|emotion|sad|happy|angry|excited/g) || []).length * 0.2 + 0.3)
  const cognitive_clarity = Math.min(0.9, (words.match(/think|understand|realize|know|clear/g) || []).length * 0.15 + 0.4)
  const energy_level = Math.min(0.9, (words.match(/energy|tired|excited|motivated|drive/g) || []).length * 0.2 + 0.5)
  const social_connection = Math.min(0.9, (words.match(/friend|family|people|together|alone/g) || []).length * 0.25 + 0.4)
  const coherence_index = (cognitive_clarity + energy_level) / 2
  const urgency_score = words.includes("crisis") || words.includes("emergency") ? 0.9 : Math.random() * 0.3 + 0.1

  return {
    archetype: {
      main_archetype: archetype,
      confidence,
      color: "#45B7D1",
      description: "AI-detected psychological archetype"
    },
    mood_vector: {
      emotional_intensity,
      cognitive_clarity,
      energy_level,
      social_connection,
      coherence_index,
      urgency_score
    },
    timestamp: Date.now(),
    session_id: "demo_session",
    insights: [
      "Strong emotional expression detected in your message",
      "Cognitive processing appears clear and structured",
      "Social awareness indicators present"
    ],
    recommendations: [
      "Continue expressing your thoughts openly",
      "Consider journaling to track emotional patterns",
      "Maintain social connections for support"
    ]
  }
}

export const EnhancedMentalHealthChat: React.FC<EnhancedMentalHealthChatProps> = ({
  onAnalyze = mockAnalyze,
  className = "",
  showBrainViz = true,
  showAnalysisPanel = true
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hello! I'm your enhanced mental health AI assistant. I can provide real-time psychological analysis and insights. How are you feeling today?",
      role: 'assistant',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [currentAnalysis, setCurrentAnalysis] = useState<MindMirrorAnalysis | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = useCallback(async () => {
    if (!input.trim() || isAnalyzing) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      role: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsAnalyzing(true)

    try {
      // Analyze user input
      const analysis = await onAnalyze(userMessage.content)
      setCurrentAnalysis(analysis)

      // Generate AI response based on analysis
      const responseContent = generateResponse(analysis)
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: responseContent,
        role: 'assistant',
        timestamp: new Date(),
        analysis
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Analysis failed:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I encountered an issue analyzing your message. Please try again.",
        role: 'assistant',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsAnalyzing(false)
    }
  }, [input, isAnalyzing, onAnalyze])

  const generateResponse = (analysis: MindMirrorAnalysis): string => {
    const archetype = analysis.archetype.main_archetype
    const urgency = analysis.mood_vector.urgency_score
    
    if (urgency > 0.8) {
      return "I notice some urgency in your message. It's important that you know support is available. Would you like to talk about what's concerning you most right now?"
    }
    
    const responses = {
      wounded_healer: "I can sense the depth of your experience. Your ability to transform challenges into wisdom is remarkable. How has this journey shaped your perspective?",
      shadow_strategist: "Your analytical approach is clear in your message. You seem to be processing this situation strategically. What factors are you considering most important?",
      visionary: "I can feel the creative energy in your words. Your forward-thinking perspective is inspiring. What vision are you working toward?",
      caregiver: "Your caring nature comes through strongly. It's beautiful how you focus on supporting others. How are you taking care of yourself too?",
      inner_child: "There's a wonderful authenticity in your expression. Your openness is refreshing. What brings you the most joy right now?",
      wise_elder: "Your thoughtful perspective shows real wisdom. I appreciate the depth of your reflection. What insights have been most meaningful to you?",
      rebel_spirit: "I can sense your drive for change and independence. Your energy is powerful. What transformation are you working toward?"
    }
    
    return responses[archetype as keyof typeof responses] || "Thank you for sharing. I can see there's a lot going on for you right now. What would be most helpful to explore together?"
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={`flex gap-6 w-full max-w-7xl mx-auto ${className}`}>
      {/* Main Chat Interface */}
      <div className={`flex-1 ${showAnalysisPanel ? 'max-w-[60%]' : 'w-full'}`}>
        <Card className="h-[700px] flex flex-col shadow-lg border-0">
          {/* Header */}
          <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">Enhanced Mental Health Chat</CardTitle>
                  <p className="text-sm text-gray-600">Real-time psychological analysis</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {isAnalyzing && (
                  <Badge variant="secondary" className="animate-pulse">
                    <Activity className="w-3 h-3 mr-1" />
                    Analyzing...
                  </Badge>
                )}
                <Badge variant="outline">
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI Enhanced
                </Badge>
              </div>
            </div>
          </CardHeader>

          {/* Messages */}
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    {message.role === 'assistant' && (
                      <Bot className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    )}
                    {message.role === 'user' && (
                      <User className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </CardContent>

          {/* Input */}
          <div className="p-4 border-t bg-gray-50">
            <div className="flex space-x-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Share your thoughts and feelings..."
                className="flex-1 min-h-[60px] resize-none"
                disabled={isAnalyzing}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isAnalyzing}
                className="self-end bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Analysis Panel */}
      {showAnalysisPanel && (
        <div className="w-[40%] space-y-6">
          {/* Brain Visualization */}
          {showBrainViz && (
            <BrainVisualization
              moodVector={currentAnalysis?.mood_vector}
              archetype={currentAnalysis?.archetype.main_archetype}
            />
          )}

          {/* Mind Mirror Dashboard */}
          <MindMirrorDashboard
            analysis={currentAnalysis}
            isAnalyzing={isAnalyzing}
          />
        </div>
      )}
    </div>
  )
}

export default EnhancedMentalHealthChat
