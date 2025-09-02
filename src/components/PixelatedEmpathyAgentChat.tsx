import React, { useState, useRef, useEffect, FC } from 'react';
import { createPixelatedEmpathyAgent, type TherapeuticScenario, type BiasAnalysis, type AgentResponse } from '../lib/ai/PixelatedEmpathyAgent';

type AgentContext = 'scenario_generation' | 'bias_detection' | 'training_recommendation' | 'general';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'agent';
  timestamp: Date;
  context?: string;
}

interface AgentChatProps {
  className?: string;
  initialContext?: AgentContext;
  onScenarioGenerated?: (scenario: TherapeuticScenario) => void;
  onBiasAnalysis?: (analysis: BiasAnalysis) => void;
}

export const PixelatedEmpathyAgentChat: FC<AgentChatProps> = ({
  className = '',
  initialContext = 'general',
  onScenarioGenerated,
  onBiasAnalysis
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState(initialContext);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const agent = useRef<ReturnType<typeof createPixelatedEmpathyAgent> | null>(null);

  useEffect(() => {
    try {
      agent.current = createPixelatedEmpathyAgent();
      setIsConnected(true);

      // Add welcome message
      setMessages([{
        id: 'welcome',
        content: `Hello! I'm your Pixelated Empathy AI Assistant. I'm specialized in clinical training scenarios, bias detection, and therapeutic guidance. How can I help you today?`,
        role: 'agent',
        timestamp: new Date(),
        context: 'system'
      }]);
    } catch (error: unknown) {
      console.error('Failed to initialize agent:', error);
      setMessages([{
        id: 'error',
        content: 'Unable to connect to the AI Agent. Please check your configuration.',
        role: 'agent',
        timestamp: new Date(),
        context: 'error'
      }]);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !agent.current || isLoading) {
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: input,
      role: 'user',
      timestamp: new Date(),
      context
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let response: AgentResponse;

      // Use specialized methods for specific contexts
      switch (context) {
        case 'scenario_generation':
          if (input.toLowerCase().includes('scenario') || input.toLowerCase().includes('generate')) {
            response = await agent.current.generateScenario({
              condition: extractCondition(input),
              difficulty: extractDifficulty(input),
              population: extractPopulation(input)
            });
          } else {
            response = await agent.current.sendMessage(input, context);
          }
          break;

        case 'bias_detection':
          response = await agent.current.analyzeBias(input);
          break;

        case 'training_recommendation':
          response = await agent.current.recommendTraining({
            experience: extractExperience(input),
            specializations: extractSpecializations(input)
          });
          break;

        default:
          response = await agent.current.sendMessage(input, context);
      }

      if (response.success && response.response) {
        const agentMessage: Message = {
          id: `agent-${Date.now()}`,
          content: response.response,
          role: 'agent',
          timestamp: new Date(),
          context
        };

        setMessages(prev => [...prev, agentMessage]);

        // Handle specific response types
        if (context === 'scenario_generation' && response.metadata?.['scenario']) {
          onScenarioGenerated?.(response.metadata['scenario'] as TherapeuticScenario);
        }
        if (context === 'bias_detection' && response.metadata?.['bias_analysis']) {
          onBiasAnalysis?.(response.metadata['bias_analysis'] as BiasAnalysis);
        }
      } else {
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          content: `Sorry, I encountered an error: ${response.error}`,
          role: 'agent',
          timestamp: new Date(),
          context: 'error'
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        content: `Sorry, I encountered an unexpected error. Please try again.`,
        role: 'agent',
        timestamp: new Date(),
        context: 'error'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    {
      label: 'Generate Depression Scenario',
      action: () => setInput('Generate a beginner-level depression training scenario'),
      context: 'scenario_generation'
    },
    {
      label: 'Analyze Bias',
      action: () => setInput('Analyze this conversation for potential biases: '),
      context: 'bias_detection'
    },
    {
      label: 'Training Recommendation',
      action: () => setInput('Recommend training modules for a beginner therapist'),
      context: 'training_recommendation'
    },
    {
      label: 'Platform Status',
      action: () => setInput('Check platform status and recent metrics'),
      context: 'general'
    }
  ];

  return (
    <div className={ `flex flex-col h-full max-w-4xl mx-auto bg-white border border-gray-200 rounded-lg shadow-lg ${className}` }>
      {/* Header */ }
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-blue-50">
        <div className="flex items-center space-x-3">
          <div className={ `w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}` } />
          <h3 className="text-lg font-semibold text-gray-800">Pixelated Empathy AI Assistant</h3>
        </div>
        <select
          value={ context }
          onChange={ (e) => setContext(e.target.value as AgentContext) }
          className="px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="general">General</option>
          <option value="scenario_generation">Scenario Generation</option>
          <option value="bias_detection">Bias Detection</option>
          <option value="training_recommendation">Training Recommendation</option>
        </select>
      </div>

      {/* Quick Actions */ }
      <div className="p-3 border-b border-gray-100 bg-gray-50">
        <div className="flex flex-wrap gap-2">
          { quickActions.map((action) => (
            <button
              key={ action.label }
              onClick={ () => {
                setContext(action.context as AgentContext);
                action.action();
              } }
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
            >
              { action.label }
            </button>
          )) }
        </div>
      </div>

      {/* Messages */ }
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        { messages.map((message) => (
          <div
            key={ message.id }
            className={ `flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}` }
          >
            <div
              className={ `max-w-3xl p-3 rounded-lg ${message.role === 'user'
                ? 'bg-blue-600 text-white'
                : message.context === 'error'
                  ? 'bg-red-100 text-red-800 border border-red-200'
                  : 'bg-gray-100 text-gray-800'
                }` }
            >
              <div className="whitespace-pre-wrap">{ message.content }</div>
              <div className={ `text-xs mt-2 ${message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                }` }>
                { message.timestamp.toLocaleTimeString() }
                { message.context && ` • ${message.context}` }
              </div>
            </div>
          </div>
        )) }
        { isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-800 p-3 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                <span>AI Assistant is thinking...</span>
              </div>
            </div>
          </div>
        ) }
        <div ref={ messagesEndRef } />
      </div>

      {/* Input */ }
      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-3">
          <input
            type="text"
            value={ input }
            onChange={ (e) => setInput(e.target.value) }
            onKeyDown={ (e) => e.key === 'Enter' && handleSend() }
            placeholder={ `Ask about ${context.replace('_', ' ')}...` }
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={ !isConnected || isLoading }
          />
          <button
            onClick={ handleSend }
            disabled={ !input.trim() || !isConnected || isLoading }
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper functions to extract information from user input
function extractCondition(input: string): 'depression' | 'anxiety' | 'ptsd' | 'bipolar' | 'substance_use' | 'personality_disorder' | 'crisis' {
  const lower = input.toLowerCase();
  if (lower.includes('depression') || lower.includes('depressed')) return 'depression';
  if (lower.includes('anxiety') || lower.includes('anxious')) return 'anxiety';
  if (lower.includes('ptsd') || lower.includes('trauma')) return 'ptsd';
  if (lower.includes('bipolar') || lower.includes('manic')) return 'bipolar';
  if (lower.includes('substance') || lower.includes('addiction')) return 'substance_use';
  if (lower.includes('personality') || lower.includes('borderline')) return 'personality_disorder';
  if (lower.includes('crisis') || lower.includes('suicidal')) return 'crisis';
  return 'depression'; // default
}

function extractDifficulty(input: string): 'beginner' | 'intermediate' | 'advanced' | 'expert' {
  const lower = input.toLowerCase();
  if (lower.includes('expert')) {
    return 'expert';
  }
  if (lower.includes('advanced')) {
    return 'advanced';
  }
  if (lower.includes('intermediate')) {
    return 'intermediate';
  }
  return 'beginner'; // default
}

function extractPopulation(input: string): 'adolescent' | 'adult' | 'geriatric' | 'cultural_minority' | 'lgbtq' | 'veteran' | undefined {
  const lower = input.toLowerCase();
  if (lower.includes('adolescent') || lower.includes('teen')) return 'adolescent';
  if (lower.includes('geriatric') || lower.includes('elderly')) return 'geriatric';
  if (lower.includes('cultural') || lower.includes('minority')) return 'cultural_minority';
  if (lower.includes('lgbtq') || lower.includes('lgbt')) return 'lgbtq';
  if (lower.includes('veteran') || lower.includes('military')) return 'veteran';
  if (lower.includes('adult')) return 'adult';
  return undefined;
}

function extractExperience(input: string): 'beginner' | 'intermediate' | 'advanced' {
  const lower = input.toLowerCase();
  if (lower.includes('advanced')) {
    return 'advanced';
  }
  if (lower.includes('intermediate')) {
    return 'intermediate';
  }
  return 'beginner';
}

function extractSpecializations(input: string): string[] {
  const specializations: string[] = [];
  const lower = input.toLowerCase();

  if (lower.includes('depression')) specializations.push('Depression');
  if (lower.includes('anxiety')) specializations.push('Anxiety');
  if (lower.includes('trauma') || lower.includes('ptsd')) specializations.push('Trauma');
  if (lower.includes('addiction') || lower.includes('substance')) specializations.push('Substance Use');
  if (lower.includes('family')) specializations.push('Family Therapy');
  if (lower.includes('group')) specializations.push('Group Therapy');

  return specializations.length > 0 ? specializations : ['General Practice'];
}
