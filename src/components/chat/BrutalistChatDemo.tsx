import React, { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    biasDetected?: boolean;
    confidenceScore?: number;
    suggestions?: string[];
  };
}

const BrutalistChatDemo: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'system',
      content: 'THERAPY TRAINING SESSION INITIALIZED. Client persona: Sarah, 28, presenting with anxiety and relationship concerns.',
      timestamp: new Date(),
    },
    {
      id: '2',
      type: 'ai',
      content: "I don't know why I'm here. My boyfriend says I need therapy but I think he's the problem.",
      timestamp: new Date(),
    }
  ]);
  
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionActive, setSessionActive] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !sessionActive) {
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI response with bias detection
    setTimeout(() => {
      const responses = [
        "That sounds really difficult. Can you tell me more about what's been happening in your relationship?",
        "I hear that you're feeling frustrated. What would you like to see change?",
        "It sounds like there might be different perspectives here. How do you think your boyfriend sees the situation?",
      ];

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        // Assert non-undefined since responses has fixed non-empty items
        content: responses[Math.floor(Math.random() * responses.length)]!,
        timestamp: new Date(),
        metadata: {
          biasDetected: Math.random() > 0.7,
          confidenceScore: Math.floor(Math.random() * 30) + 70,
          suggestions: ['Consider exploring both perspectives', 'Validate client emotions', 'Avoid taking sides']
        }
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const endSession = () => {
    setSessionActive(false);
    const systemMessage: Message = {
      id: Date.now().toString(),
      type: 'system',
      content: 'SESSION ENDED. Performance analysis available in dashboard.',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Session Header */}
      <div className="bg-gray-900 border-2 border-gray-700 p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="status-indicator status-indicator--online">
              <div className="pulse-dot pulse-dot--green"></div>
              <span className="font-bold">TRAINING SESSION</span>
            </div>
            <div className="brutalist-badge brutalist-badge--info">
              BIAS DETECTION: ON
            </div>
          </div>
          <button
            onClick={endSession}
            className="brutalist-button brutalist-button--outline text-sm px-4 py-2"
            disabled={!sessionActive}
          >
            END SESSION
          </button>
        </div>
      </div>

      {/* Chat Container */}
      <div className="chat-container">
        {/* Chat Header */}
        <div className="chat-header">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white">CLIENT: SARAH M.</h3>
              <p className="text-sm text-gray-400">Anxiety, Relationship Issues</p>
            </div>
            <div className="flex gap-2">
              <div className="brutalist-badge brutalist-badge--warning text-xs">
                DIFFICULTY: MODERATE
              </div>
              <div className="brutalist-badge brutalist-badge--info text-xs">
                BIAS RISK: LOW
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {messages.map((message) => (
            <div key={message.id} className="space-y-2">
              <div className={`message ${
                message.type === 'user' ? 'message--user' : 
                message.type === 'system' ? 'bg-yellow-900/20 border border-yellow-600 text-yellow-200 text-center text-sm' :
                'message--ai'
              }`}>
                {message.type !== 'system' && (
                  <div className="text-xs opacity-70 mb-1 font-bold uppercase tracking-wide">
                    {message.type === 'user' ? 'THERAPIST' : 'CLIENT'}
                  </div>
                )}
                <div className={message.type === 'system' ? 'font-bold' : ''}>
                  {message.content}
                </div>
              </div>

              {/* Bias Detection Alert */}
              {message.metadata?.biasDetected && (
                <div className="alert alert--warning text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span>⚠️</span>
                    <span className="font-bold">POTENTIAL BIAS DETECTED</span>
                  </div>
                  <div className="text-xs">
                    <strong>Suggestions:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {message.metadata.suggestions?.map((suggestion) => (
                        <li key={suggestion}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Confidence Score */}
              {message.metadata?.confidenceScore && message.type === 'user' && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>CONFIDENCE:</span>
                  <div className="progress-bar w-20">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${message.metadata.confidenceScore}%` }}
                    ></div>
                  </div>
                  <span>{message.metadata.confidenceScore}%</span>
                </div>
              )}
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="message message--ai">
              <div className="text-xs opacity-70 mb-1 font-bold uppercase tracking-wide">
                CLIENT
              </div>
              <div className="flex items-center gap-2">
                <span>Typing</span>
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="chat-input-area">
          <div className="flex gap-3">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={sessionActive ? "Type your therapeutic response..." : "Session ended"}
              className="form-input form-textarea resize-none"
              rows={2}
              disabled={!sessionActive}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || !sessionActive}
              className="brutalist-button brutalist-button--primary px-6 py-2 self-end"
            >
              SEND
            </button>
          </div>
          
          {sessionActive && (
            <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
              <div className="flex items-center gap-4">
                <span>Press Enter to send</span>
                <span>•</span>
                <span>Shift+Enter for new line</span>
              </div>
              <div className="flex items-center gap-2">
                <span>REAL-TIME ANALYSIS:</span>
                <div className="status-indicator status-indicator--online">
                  <div className="pulse-dot pulse-dot--green"></div>
                  <span>ACTIVE</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Session Stats */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="metric-card">
          <div className="metric-value">{messages.filter(m => m.type === 'user').length}</div>
          <div className="metric-label">Responses</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{messages.filter(m => m.metadata?.biasDetected).length}</div>
          <div className="metric-label">Bias Alerts</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">
            {Math.round(messages.filter(m => m.metadata?.confidenceScore).reduce((acc, m) => acc + (m.metadata?.confidenceScore || 0), 0) / messages.filter(m => m.metadata?.confidenceScore).length) || 0}%
          </div>
          <div className="metric-label">Avg Confidence</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{Math.floor((Date.now() - (messages[0]?.timestamp?.getTime() ?? Date.now())) / 60000)}</div>
          <div className="metric-label">Minutes</div>
        </div>
      </div>
    </div>
  );
};

export default BrutalistChatDemo;