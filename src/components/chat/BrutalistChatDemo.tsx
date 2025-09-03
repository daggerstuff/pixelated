import React, { useState } from 'react';
import type { FC } from 'react';
import { createPersonaMessage, getPersonaContext } from './PersonaService'
import type { PersonaServiceConfig } from './PersonaService'
import { ChatShell } from './ChatShell'

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot' | 'system';
  content: string;
  timestamp: Date;
  personaContext?: {
    scenario: string;
    tone: string;
    traits: string[];
  };
  metadata?: {
    biasDetected?: boolean;
    confidenceScore?: number;
    suggestions?: string[];
  };
}

const BrutalistChatDemo: FC = () => {
  // Use PersonaService for persona context
  const personaConfig: PersonaServiceConfig = { mode: 'deterministic' }; // Future: set based on UI or API
  getPersonaContext(personaConfig);
  const [messages, setMessages] = useState<ChatMessage[]>([
    createPersonaMessage({
      baseId: '1',
      role: 'system',
      content: 'THERAPY TRAINING SESSION INITIALIZED. You are the therapist. Client persona: Sarah, 28, presenting with anxiety and relationship concerns.',
      timestamp: new Date(),
      config: personaConfig,
    }),
    createPersonaMessage({
      baseId: '2',
      role: 'bot',
      content: "I don't know why I'm here. My boyfriend says I need therapy but I think he's the problem.",
      timestamp: new Date(),
      config: personaConfig,
    }),
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionActive, setSessionActive] = useState(true);

  // Scroll management will be handled by ChatShell render prop


  const handleSendMessage = async () => {
    if (!inputValue.trim() || !sessionActive) {
      return;
    }

    const userMessage = createPersonaMessage({
      content: inputValue,
      role: 'user',
      config: personaConfig,
      metadata: {
        biasDetected: Math.random() > 0.8, // Bias detection for therapist responses
        confidenceScore: Math.floor(Math.random() * 30) + 70,
        suggestions: ['Consider exploring both perspectives', 'Validate client emotions', 'Avoid taking sides']
      }
    });

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate persona-based response (to be enhanced with a real PersonaService later)
    setTimeout(() => {
      const responses = [
        "That sounds really difficult. Can you tell me more about what's been happening in your relationship?",
        "I hear that you're feeling frustrated. What would you like to see change?",
        "It sounds like there might be different perspectives here. How do you think your boyfriend sees the situation?",
        "He just doesn't listen to me anymore. Every time I try to talk about something important, he gets defensive.",
        "I feel like I'm walking on eggshells around him. I can't say anything without it turning into an argument.",
        "Maybe you're right... but it's hard to see past all the hurt and frustration right now."
      ];

      const botMessage = createPersonaMessage({
        content: responses[Math.floor(Math.random() * responses.length)]!,
        role: 'bot',
        config: personaConfig,
        metadata: {
          confidenceScore: Math.floor(Math.random() * 20) + 80 // Client confidence in sharing
        }
      });

      setMessages(prev => [...prev, botMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const endSession = () => {
    setSessionActive(false);
    const systemMessage = createPersonaMessage({
      content: 'SESSION ENDED. Performance analysis available in dashboard.',
      role: 'system',
      config: personaConfig,
    });
    setMessages(prev => [...prev, systemMessage]);
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Simplified Session Header */ }
      <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-slate-200">Training Session</span>
            </div>
            <div className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
              Bias Detection: Active
            </div>
          </div>
          <button
            onClick={ endSession }
            className="text-xs px-3 py-1.5 border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white rounded transition-colors"
            disabled={ !sessionActive }
          >
            End Session
          </button>
        </div>
      </div>

      {/* Main Chat Interface */ }
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Chat Header */ }
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">Client: Sarah M.</h3>
              <p className="text-sm text-slate-600">Anxiety, Relationship Issues</p>
            </div>
            <div className="flex gap-2">
              <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                Moderate Difficulty
              </span>
              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                Low Bias Risk
              </span>
            </div>
          </div>
        </div>

        {/* Messages Area - Made Much Larger */ }
        <ChatShell autoScrollDeps={ [messages] }>
          { ({ messagesEndRef, containerRef }) => (
            <div ref={ containerRef } className="h-96 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
              { messages.map((message) => (
                <div key={ message.id } className="space-y-2">
                  <div className={ `max-w-[85%] ${message.role === 'user' ? 'ml-auto' :
                    message.role === 'system' ? 'mx-auto' :
                      'mr-auto'
                    }` }>
                    { message.role === 'system' ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                        <div className="text-sm text-amber-800 font-medium">
                          { message.content }
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-xs text-slate-500 mb-1 font-medium">
                          { message.role === 'user' ? 'THERAPIST' : 'CLIENT' }
                        </div>
                        <div className={ `rounded-2xl px-4 py-3 ${message.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white border border-slate-200 text-slate-800 shadow-sm'
                          }` }>
                          { message.content }
                        </div>
                      </>
                    ) }
                  </div>

                  {/* Bias Detection Alert - Refined */ }
                  { message.metadata?.biasDetected && message.role === 'user' && (
                    <div className="max-w-[85%] ml-auto">
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                        <div className="flex items-center gap-2 mb-2 text-amber-800">
                          <span>⚠️</span>
                          <span className="font-medium">Potential Bias Detected</span>
                        </div>
                        <div className="text-amber-700">
                          <strong>Suggestions:</strong>
                          <ul className="list-disc list-inside mt-1 space-y-1">
                            { message.metadata.suggestions?.map((suggestion) => (
                              <li key={ suggestion } className="text-xs">{ suggestion }</li>
                            )) }
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) }

                  {/* Confidence Indicators - Subtle */ }
                  { message.metadata?.confidenceScore && (
                    <div className={ `text-xs text-slate-500 flex items-center gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'
                      }` }>
                      <span>
                        { message.role === 'user' ? 'Therapeutic Confidence:' : 'Client Openness:' }
                      </span>
                      <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={ `h-full rounded-full ${message.role === 'user' ? 'bg-blue-400' : 'bg-green-400'
                            }` }
                          style={ { width: `${message.metadata.confidenceScore}%` } }
                        ></div>
                      </div>
                      <span className="font-medium">{ message.metadata.confidenceScore }%</span>
                    </div>
                  ) }
                </div>
              )) }

              {/* Typing Indicator */ }
              { isTyping && (
                <div className="max-w-[85%] mr-auto">
                  <div className="text-xs text-slate-500 mb-1 font-medium">CLIENT</div>
                  <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <span>Typing</span>
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse"></div>
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse" style={ { animationDelay: '0.2s' } }></div>
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse" style={ { animationDelay: '0.4s' } }></div>
                      </div>
                    </div>
                  </div>
                </div>
              ) }

              <div ref={ messagesEndRef } />
            </div>
          ) }
        </ChatShell>

        {/* Chat Input - Streamlined */ }
        <div className="border-t border-slate-200 p-4 bg-white">
          <div className="flex gap-3">
            <textarea
              value={ inputValue }
              onChange={ (e) => setInputValue(e.target.value) }
              onKeyDown={ handleKeyDown }
              placeholder={ sessionActive ? "Type your therapeutic response..." : "Session ended" }
              className="flex-1 resize-none border border-slate-300 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={ 2 }
              disabled={ !sessionActive }
            />
            <button
              onClick={ handleSendMessage }
              disabled={ !inputValue.trim() || !sessionActive }
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Send
            </button>
          </div>

          { sessionActive && (
            <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
              <div className="flex items-center gap-4">
                <span>Press Enter to send • Shift+Enter for new line</span>
              </div>
              <div className="flex items-center gap-2">
                <span>Real-time Analysis:</span>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-green-600 font-medium">Active</span>
                </div>
              </div>
            </div>
          ) }
        </div>
      </div>

      {/* Compact Session Stats */ }
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-slate-800">{ messages.filter(m => m.role === 'user').length }</div>
          <div className="text-xs text-slate-600">Responses</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-slate-800">{ messages.filter(m => m.metadata?.biasDetected).length }</div>
          <div className="text-xs text-slate-600">Bias Alerts</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-slate-800">
            { (() => {
              const messagesWithConfidence = messages.filter(m => m.metadata?.confidenceScore);
              const totalConfidence = messagesWithConfidence.reduce((acc, m) => acc + (m.metadata?.confidenceScore || 0), 0);
              return messagesWithConfidence.length > 0 ? Math.round(totalConfidence / messagesWithConfidence.length) : 0;
            })() }%
          </div>
          <div className="text-xs text-slate-600">Avg Confidence</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-slate-800">{ Math.floor((Date.now() - (messages[0]?.timestamp?.getTime() ?? Date.now())) / 60000) }</div>
          <div className="text-xs text-slate-600">Minutes</div>
        </div>
      </div>
    </div>
  );
};

export default BrutalistChatDemo;