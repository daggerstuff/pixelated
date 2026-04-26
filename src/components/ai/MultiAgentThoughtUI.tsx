import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Brain, 
  Activity, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  Search, 
  Wrench,
  ChevronDown,
  ChevronUp,
  Clock,
  ThumbsUp,
  ThumbsDown,
  MessageSquarePlus,
  Send,
  X,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentActivity, AgentActivityStatus, AgentActivityType } from '@/types/chat';

interface MultiAgentThoughtUIProps {
  activities: AgentActivity[];
  isLive?: boolean;
  onFeedback?: (activityId: string, feedback: 'positive' | 'negative' | 'correction', comment?: string) => Promise<void>;
  className?: string;
}

const ActivityIcon = ({ type, status }: { type: AgentActivityType; status: AgentActivityStatus }) => {
  if (status === 'thinking') return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />;
  if (status === 'error') return <AlertCircle className="w-4 h-4 text-red-500" />;
  
  switch (type) {
    case 'thought':
      return <Brain className="w-4 h-4 text-purple-400" />;
    case 'action':
      return <Activity className="w-4 h-4 text-green-400" />;
    case 'observation':
      return <Search className="w-4 h-4 text-amber-400" />;
    case 'tool_use':
      return <Wrench className="w-4 h-4 text-indigo-400" />;
    default:
      return <Bot className="w-4 h-4 text-gray-400" />;
  }
};

const StatusBadge = ({ status }: { status: AgentActivityStatus }) => {
  const styles = {
    thinking: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    acting: 'bg-green-500/10 text-green-400 border-green-500/20',
    completed: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    error: 'bg-red-500/10 text-red-400 border-red-500/20'
  };

  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wider", styles[status])}>
      {status}
    </span>
  );
};

const StateInspector = ({ state }: { state: Record<string, any> }) => {
  return (
    <div className="space-y-2 mt-4 pt-4 border-t border-white/5">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-3 h-3 text-emerald-400" />
        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Turn State Snapshot</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(state).map(([key, value]) => (
          <div key={key} className="p-2 rounded bg-black/30 border border-white/5 flex flex-col gap-1">
            <span className="text-[8px] text-white/40 uppercase font-mono">{key}</span>
            <span className="text-[10px] text-white/90 truncate font-mono">
              {Array.isArray(value) ? `[${value.join(', ')}]` : String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const MultiAgentThoughtUI: React.FC<MultiAgentThoughtUIProps> = ({ 
  activities, 
  isLive = false,
  onFeedback,
  className 
}) => {
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [feedbackState, setFeedbackState] = useState<Record<string, 'positive' | 'negative' | 'correction' | null>>({});
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});
  const [correctionText, setCorrectionText] = useState<Record<string, string>>({});
  const [showCorrectionInput, setShowCorrectionInput] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleFeedbackClick = async (activityId: string, type: 'positive' | 'negative' | 'correction') => {
    if (!onFeedback || isSubmitting[activityId]) return;
    
    if (type === 'correction' && !showCorrectionInput[activityId]) {
      setShowCorrectionInput(prev => ({ ...prev, [activityId]: true }));
      return;
    }

    // Optimistic update
    setFeedbackState(prev => ({ ...prev, [activityId]: type }));
    setIsSubmitting(prev => ({ ...prev, [activityId]: true }));
    
    try {
      await onFeedback(activityId, type, correctionText[activityId]);
      setShowCorrectionInput(prev => ({ ...prev, [activityId]: false }));
    } catch (err) {
      // Revert on error
      setFeedbackState(prev => ({ ...prev, [activityId]: null }));
    } finally {
      setIsSubmitting(prev => ({ ...prev, [activityId]: false }));
    }
  };

  // Auto-expand new activities if live
  useEffect(() => {
    if (isLive && activities.length > 0) {
      const lastActivity = activities[activities.length - 1];
      if (lastActivity) {
        setExpandedItems(prev => ({ ...prev, [lastActivity.id]: true }));
      }
    }
  }, [activities.length, isLive]);

  return (
    <div className={cn("flex flex-col gap-4 p-4 rounded-xl border border-white/10 bg-black/40 backdrop-blur-md", className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Agent reasoning chain</h3>
        </div>
        {isLive && (
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Live</span>
          </div>
        )}
      </div>

      <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-white/10">
        {activities.map((activity, index) => (
          <div key={activity.id} className="relative pl-8 group">
            {/* Timeline dot */}
            <div className={cn(
              "absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border bg-gray-950 z-10 transition-colors",
              activity.status === 'thinking' ? "border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.2)]" : "border-white/10"
            )}>
              <ActivityIcon type={activity.type} status={activity.status} />
            </div>

            <div className={cn(
              "rounded-lg border bg-white/5 overflow-hidden transition-all",
              activity.status === 'thinking' ? "border-blue-500/30" : "border-white/5",
              expandedItems[activity.id] ? "ring-1 ring-white/10" : ""
            )}>
              {/* Header */}
              <button 
                onClick={() => toggleExpand(activity.id)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-white/5 transition-colors"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-300">{activity.agentName}</span>
                    <span className="text-[10px] text-white/40">•</span>
                    <span className="text-xs text-white/70 font-medium">{activity.type.replace('_', ' ')}</span>
                  </div>
                  <div className="text-xs text-white/90 line-clamp-1">
                    {activity.content}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {activity.conflict && (
                    <div className={cn(
                      "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border",
                      activity.conflict.severity === 'high' ? "bg-red-500/20 text-red-400 border-red-500/30" :
                      activity.conflict.severity === 'medium' ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                      "bg-blue-500/20 text-blue-400 border-blue-500/30"
                    )}>
                      <AlertTriangle className="w-2.5 h-2.5" />
                      Conflict
                    </div>
                  )}
                  <StatusBadge status={activity.status} />
                  {expandedItems[activity.id] ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
                </div>
              </button>

              {/* Expanded Content */}
              {expandedItems[activity.id] && (
                <div className="p-3 pt-0 border-t border-white/5 bg-black/20">
                  <div className="mt-3 space-y-3">
                    {activity.conflict && (
                      <div className={cn(
                        "p-3 rounded-lg border flex flex-col gap-2 mb-2",
                        activity.conflict.severity === 'high' ? "bg-red-500/10 border-red-500/20" :
                        activity.conflict.severity === 'medium' ? "bg-amber-500/10 border-amber-500/20" :
                        "bg-blue-500/10 border-blue-500/20"
                      )}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-tighter text-white/60">Disagreement Detected</span>
                          <span className="text-[9px] font-bold text-white/40">VS {activity.conflict.withAgent}</span>
                        </div>
                        <p className="text-xs text-white/90 leading-tight">
                          {activity.conflict.description}
                        </p>
                      </div>
                    )}
                    
                    {activity.thought && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Internal Thought</div>
                        <div className="text-xs text-white/80 leading-relaxed italic bg-purple-500/5 p-2 rounded border border-purple-500/10">
                          {activity.thought}
                        </div>
                      </div>
                    )}
                    
                    {activity.action && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Action Taken</div>
                        <div className="text-xs font-mono text-green-300 bg-black/40 p-2 rounded border border-green-500/10">
                          {activity.action}
                        </div>
                      </div>
                    )}

                    {activity.observation && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Observation</div>
                        <div className="text-xs text-white/70 bg-white/5 p-2 rounded">
                          {activity.observation}
                        </div>
                      </div>
                    )}

                    {activity.shared_state && (
                      <StateInspector state={activity.shared_state} />
                    )}

                    <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-white/5">
                      {showCorrectionInput[activity.id] && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-indigo-400 uppercase">Supervisor Correction</span>
                            <button 
                              onClick={() => setShowCorrectionInput(prev => ({ ...prev, [activity.id]: false }))}
                              className="text-white/20 hover:text-white/40"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="relative">
                            <textarea 
                              value={correctionText[activity.id] || ''}
                              onChange={(e) => setCorrectionText(prev => ({ ...prev, [activity.id]: e.target.value }))}
                              placeholder="Describe how the agent should have reasoned..."
                              className="w-full bg-black/40 border border-indigo-500/30 rounded-md p-2 text-xs text-white focus:outline-none focus:border-indigo-500/60 min-h-[60px] resize-none"
                            />
                            <button 
                              onClick={() => handleFeedbackClick(activity.id, 'correction')}
                              disabled={isSubmitting[activity.id] || !correctionText[activity.id]?.trim()}
                              className="absolute bottom-2 right-2 p-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-md transition-colors disabled:opacity-50"
                            >
                              {isSubmitting[activity.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[10px] text-white/40">
                          <Clock className="w-3 h-3" />
                          {new Date(activity.timestamp).toLocaleTimeString()}
                        </div>
                        
                        {onFeedback && (
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleFeedbackClick(activity.id, 'positive'); }}
                              disabled={isSubmitting[activity.id]}
                              className={cn(
                                "p-1.5 rounded-md transition-all",
                                feedbackState[activity.id] === 'positive' 
                                  ? "bg-green-500/20 text-green-400 scale-110" 
                                  : "hover:bg-green-500/10 text-white/30 hover:text-green-400"
                              )}
                              title="Valid reasoning"
                            >
                              <ThumbsUp className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleFeedbackClick(activity.id, 'negative'); }}
                              disabled={isSubmitting[activity.id]}
                              className={cn(
                                "p-1.5 rounded-md transition-all",
                                feedbackState[activity.id] === 'negative' 
                                  ? "bg-red-500/20 text-red-400 scale-110" 
                                  : "hover:bg-red-500/10 text-white/30 hover:text-red-400"
                              )}
                              title="Invalid/Hallucinated"
                            >
                              <ThumbsDown className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleFeedbackClick(activity.id, 'correction'); }}
                              disabled={isSubmitting[activity.id]}
                              className={cn(
                                "flex items-center gap-1 px-2 py-1 rounded-md transition-all text-[10px] font-bold uppercase",
                                feedbackState[activity.id] === 'correction' || showCorrectionInput[activity.id]
                                  ? "bg-indigo-500 text-white"
                                  : "bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20"
                              )}
                            >
                              <MessageSquarePlus className="w-3 h-3" />
                              {isSubmitting[activity.id] ? 'Saving...' : 'Correct'}
                            </button>
                          </div>
                        )}

                        {!onFeedback && activity.metadata && (
                          <div className="text-[10px] text-indigo-300 font-medium">
                            {Object.keys(activity.metadata).length} metadata fields
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {activities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bot className="w-12 h-12 text-white/10 mb-3" />
            <p className="text-sm text-white/40">No agent activity detected yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiAgentThoughtUI;
