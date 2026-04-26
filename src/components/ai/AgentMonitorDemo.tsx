import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause, Plus, Trash2, Zap, Send, Loader2, BarChart3, Download, RotateCcw } from 'lucide-react';
import { MultiAgentThoughtUI } from './MultiAgentThoughtUI';
import { AgentPerformanceHeatmap, type AgentMetric } from './AgentPerformanceHeatmap';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAgentThoughtStream } from '@/hooks/useAgentThoughtStream';
import type { AgentActivity, AgentActivityType } from '@/types/chat';

const SAMPLE_AGENTS = [
  { name: 'Coordinator', role: 'Orchestrator' },
  { name: 'Psychologist', role: 'Clinical Analysis' },
  { name: 'Safety Guard', role: 'Content Moderation' },
  { name: 'Memory Agent', role: 'Context Retrieval' },
];

const ACTIVITY_TEMPLATES: Array<{type: AgentActivityType, content: string, thought?: string, action?: string, observation?: string}> = [
  { 
    type: 'thought', 
    content: 'Analyzing user input for emotional undertones.',
    thought: 'The user seems to be expressing a high level of frustration, possibly linked to recent workplace changes mentioned in previous sessions.'
  },
  { 
    type: 'action', 
    content: 'Querying long-term memory for relevant clinical history.',
    action: 'db.query("clinical_history", { userId: "user_123", focus: "workplace_stress" })'
  },
  { 
    type: 'observation', 
    content: 'Retrieved 3 relevant sessions from last month.',
    observation: 'Found sessions on 2026-03-12, 2026-03-19, and 2026-03-26 focusing on boundary setting with managers.'
  },
  { 
    type: 'tool_use', 
    content: 'Executing safety scan on proposed response.',
    action: 'safety_service.scan(proposed_text, { strict_mode: true })'
  },
  { 
    type: 'thought', 
    content: 'Synthesizing empathetic response with CBT techniques.',
    thought: 'I should use a validation statement followed by a gentle challenge to the "always/never" cognitive distortion detected.'
  }
];

export const AgentMonitorDemo: React.FC = () => {
  // Local state for simulation
  const [localActivities, setLocalActivities] = useState<AgentActivity[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
  
  // Unique session ID for the current "Live" session
  const sessionTurnId = useMemo(() => Math.random().toString(36).substring(2, 15), []);
  
  // Performance stats state
  const [stats, setStats] = useState<Record<string, AgentMetric>>({});
  
  // Backend streaming state
  const [mode, setMode] = useState<'simulation' | 'backend'>('simulation');
  const [query, setQuery] = useState('');
  const { 
    activities: backendActivities, 
    isStreaming, 
    streamInference, 
    clearActivities: clearBackend 
  } = useAgentThoughtStream();

  const currentActivities = mode === 'simulation' ? localActivities : backendActivities;

  const addRandomActivity = useCallback(() => {
    const agent = SAMPLE_AGENTS[Math.floor(Math.random() * SAMPLE_AGENTS.length)];
    const template = ACTIVITY_TEMPLATES[Math.floor(Math.random() * ACTIVITY_TEMPLATES.length)];
    
    if (!agent || !template) return;

    const newActivity: AgentActivity = {
      id: Math.random().toString(36).substring(2, 9),
      agentName: agent.name,
      agentRole: agent.role,
      type: template.type,
      content: template.content,
      thought: template.thought,
      action: template.action,
      observation: template.observation,
      status: Math.random() > 0.3 ? 'completed' : 'thinking',
      timestamp: Date.now(),
      metadata: { session: 'demo-123' }
    };

    setLocalActivities(prev => [...prev, newActivity].slice(-20));
  }, []);

  const toggleSimulation = () => {
    if (isSimulating) {
      if (intervalId) clearInterval(intervalId);
      setIntervalId(null);
    } else {
      const id = setInterval(addRandomActivity, 2500);
      setIntervalId(id);
      setMode('simulation');
    }
    setIsSimulating(!isSimulating);
  };

  const handleBackendInfer = async () => {
    if (!query.trim() || isStreaming) return;
    setMode('backend');
    if (isSimulating) toggleSimulation();
    await streamInference(query);
  };

  const clearLog = () => {
    if (mode === 'simulation') setLocalActivities([]);
    else clearBackend();
  };

  const resetPerformanceStats = async () => {
    try {
      await fetch('/api/ai/pixel/stats', { method: 'POST' }); // The proxy handles POST as reset
      fetchStats();
    } catch (err) {
      console.error('Failed to reset stats');
    }
  };

  const exportForAudit = () => {
    const data = {
      turnId: mode === 'backend' ? sessionTurnId : 'simulation',
      timestamp: new Date().toISOString(),
      activities: currentActivities,
      performance: stats
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-audit-${data.turnId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Fetch performance stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/ai/pixel/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats');
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, 5000);
    return () => clearInterval(id);
  }, [fetchStats]);

  useEffect(() => {
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [intervalId]);

  const handleFeedback = async (activityId: string, feedback: 'positive' | 'negative' | 'correction', comment?: string) => {
    try {
      const response = await fetch('/api/ai/pixel/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId,
          feedback,
          comment,
          userId: 'demo-user',
          turnId: mode === 'backend' ? sessionTurnId : undefined
        })
      });
      
      if (!response.ok) throw new Error('Failed to save feedback');
      
      // Auto-Correction Loop: Re-run inference with the directive
      if (feedback === 'correction' && comment && mode === 'backend') {
        await streamInference(query, [], { 
          gestaltDirective: comment
        } as any);
      }
      
      console.log(`Feedback ${feedback} saved for ${activityId}`);
    } catch (err) {
      console.error('Error saving feedback:', err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <MultiAgentThoughtUI 
          activities={currentActivities} 
          isLive={isSimulating || isStreaming} 
          onFeedback={handleFeedback}
          className="min-h-[600px]"
        />
      </div>

      <div className="space-y-6">
        {/* Performance Heatmap */}
        <div className="relative group">
          <AgentPerformanceHeatmap stats={stats} />
          <button 
            onClick={resetPerformanceStats}
            className="absolute top-6 right-6 p-1.5 rounded-md bg-black/40 text-white/20 hover:text-white/60 transition-all opacity-0 group-hover:opacity-100"
            title="Reset Statistics"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white">Controls</h3>
            <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
              <button 
                onClick={() => setMode('simulation')}
                className={cn(
                  "px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all",
                  mode === 'simulation' ? "bg-indigo-500 text-white shadow-lg" : "text-white/40 hover:text-white/60"
                )}
              >
                Sim
              </button>
              <button 
                onClick={() => setMode('backend')}
                className={cn(
                  "px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all",
                  mode === 'backend' ? "bg-emerald-500 text-white shadow-lg" : "text-white/40 hover:text-white/60"
                )}
              >
                Live
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {mode === 'simulation' ? (
              <>
                <Button 
                  onClick={toggleSimulation}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 h-12",
                    isSimulating ? "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30" : "bg-indigo-500/20 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/30"
                  )}
                  variant="outline"
                >
                  {isSimulating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isSimulating ? 'Stop Simulation' : 'Start Simulation'}
                </Button>
                <Button 
                  onClick={addRandomActivity}
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2 border-white/10 text-white/70 hover:bg-white/10 h-11"
                >
                  <Plus className="w-4 h-4" />
                  Inject Step
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Enter user query to test backend..."
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 min-h-[100px] resize-none"
                  />
                  <Button
                    onClick={handleBackendInfer}
                    disabled={!query.trim() || isStreaming}
                    className="absolute bottom-2 right-2 h-8 w-8 p-0 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full"
                  >
                    {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-white/30 italic text-center">
                  This will call the actual FastAPI endpoint `/infer-stream`
                </p>
              </div>
            )}

            <Button 
              onClick={clearLog}
              variant="outline"
              className="w-full flex items-center justify-center gap-2 border-white/10 text-white/40 hover:text-white/70 h-11"
            >
              <Trash2 className="w-4 h-4" />
              Clear Feed
            </Button>

            <Button 
              onClick={exportForAudit}
              variant="outline"
              disabled={currentActivities.length === 0}
              className="w-full flex items-center justify-center gap-2 border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/10 h-11"
            >
              <Download className="w-4 h-4" />
              Export for Audit
            </Button>
          </div>

          <div className="mt-8">
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4">Active Agents</h4>
            <div className="space-y-3">
              {SAMPLE_AGENTS.map(agent => (
                <div key={agent.name} className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white/90">{agent.name}</span>
                    <span className="text-[10px] text-white/40 uppercase">{agent.role}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.5)]",
                      mode === 'backend' ? "bg-emerald-500 shadow-emerald-500/50" : "bg-indigo-500 shadow-indigo-500/50"
                    )}></span>
                    <span className="text-[10px] font-medium text-white/60">Ready</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
          <h3 className="text-sm font-bold text-indigo-300 mb-2 uppercase tracking-tight flex items-center gap-2">
            <Zap className="w-3 h-3" />
            System Protocol
          </h3>
          <p className="text-xs text-white/60 leading-relaxed">
            {mode === 'simulation' 
              ? "Currently in Simulation Mode. This uses generated events to test the UI layout and responsiveness."
              : "Currently in Live Mode. This establishes a real Server-Sent Events (SSE) connection to the Python inference engine."
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default AgentMonitorDemo;
