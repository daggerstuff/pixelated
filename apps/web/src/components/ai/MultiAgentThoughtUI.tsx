import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Brain, 
  Activity, 
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
  if (status === 'thinking') return <Loader2 className="w-4 h-4 animate-spin text-foreground" />;
  if (status === 'error') return <AlertCircle className="w-4 h-4 text-foreground" />;
  
  switch (type) {
    case 'thought':
      return <Brain className="w-4 h-4 text-foreground" />;
    case 'action':
      return <Activity className="w-4 h-4 text-foreground" />;
    case 'observation':
      return <Search className="w-4 h-4 text-foreground" />;
    case 'tool_use':
      return <Wrench className="w-4 h-4 text-foreground" />;
    default:
      return <Bot className="w-4 h-4 text-muted-foreground" />;
  }
};

const StatusBadge = ({ status }: { status: AgentActivityStatus }) => {
  const styles = {
    thinking: 'bg-secondary text-foreground border border-input',
    acting: 'bg-secondary text-foreground font-medium border border-input',
    completed: 'bg-secondary text-muted-foreground border border-border',
    error: 'bg-card text-foreground font-semibold border border-ring'
  };

  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wider", styles[status])}>
      {status}
    </span>
  );
};

const StateInspector = ({ state }: { state: Record<string, any> }) => {
  return (
    <div className="space-y-2 mt-4 pt-4 border-t border-border">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-3 h-3 text-foreground" />
        <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">Turn State Snapshot</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(state).map(([key, value]) => (
          <div key={key} className="p-2 rounded bg-secondary border border-border flex flex-col gap-1">
            <span className="text-[8px] text-muted-foreground uppercase font-mono">{key}</span>
            <span className="text-[10px] text-foreground/90 truncate font-mono">
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
  const [lastAutoExpandedId, setLastAutoExpandedId] = useState<string | null>(null);

  if (isLive && activities.length > 0) {
    const lastActivity = activities[activities.length - 1];
    if (lastActivity && lastActivity.id !== lastAutoExpandedId) {
      setLastAutoExpandedId(lastActivity.id);
      setExpandedItems(prev => prev[lastActivity.id] ? prev : { ...prev, [lastActivity.id]: true });
    }
  }

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

  return (
    <div className={cn("flex flex-col gap-4 p-4 rounded-none border border-border bg-card", className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Agent reasoning chain</h3>
        </div>
        {isLive && (
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-none bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-none h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-[10px] font-bold text-foreground uppercase tracking-widest">Live</span>
          </div>
        )}
      </div>

      <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-border">
        {activities.map((activity, _index) => (
          <div key={activity.id} className="relative pl-8 group">
            {/* Timeline dot */}
            <div className={cn(
              "absolute left-0 top-1 w-6 h-6 rounded-none flex items-center justify-center border bg-card z-10 transition-colors",
              activity.status === 'thinking' ? "border-ring" : "border-border"
            )}>
              <ActivityIcon type={activity.type} status={activity.status} />
            </div>

            <div className={cn(
              "rounded-none border border-border bg-secondary overflow-hidden transition-all",
              activity.status === 'thinking' ? "border-ring" : "border-border",
              expandedItems[activity.id] ? "ring-1 ring-border" : ""
            )}>
              {/* Header */}
              <button 
                type="button"
                onClick={() => toggleExpand(activity.id)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-secondary transition-colors"
                aria-expanded={!!expandedItems[activity.id]}
                aria-controls={`activity-details-${activity.id}`}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">{activity.agentName}</span>
                    <span className="text-[10px] text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground font-medium">{activity.type.replace('_', ' ')}</span>
                  </div>
                  <div className="text-xs text-foreground/90 line-clamp-1">
                    {activity.content}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {activity.conflict && (
                    <div className={cn(
                      "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border",
                      activity.conflict.severity === 'high' ? "bg-card text-foreground font-semibold border border-ring" :
                      activity.conflict.severity === 'medium' ? "bg-secondary text-foreground font-medium border border-ring" :
                      "bg-secondary text-foreground border border-input"
                    )}>
                      <AlertTriangle className="w-2.5 h-2.5" />
                      Conflict
                    </div>
                  )}
                  <StatusBadge status={activity.status} />
                  {expandedItems[activity.id] ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {/* Expanded Content - always rendered in DOM for aria-controls to reference a valid element */}
              <div
                id={`activity-details-${activity.id}`}
                className={cn(
                  "p-3 pt-0 border-t border-border bg-secondary transition-all duration-200",
                  expandedItems[activity.id] ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"
                )}
              >
                <div className="mt-3 space-y-3">
                  {activity.conflict && (
                    <div className={cn(
                      "p-3 rounded-none border flex flex-col gap-2 mb-2",
                      activity.conflict.severity === 'high' ? "bg-card border-ring" :
                      activity.conflict.severity === 'medium' ? "bg-secondary border-ring" :
                      "bg-secondary border-input"
                    )}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-tighter text-foreground/60">Disagreement Detected</span>
                        <span className="text-[9px] font-bold text-muted-foreground">VS {activity.conflict.withAgent}</span>
                      </div>
                      <p className="text-xs text-foreground/90 leading-tight">
                        {activity.conflict.description}
                      </p>
                    </div>
                  )}
                  
                  {activity.thought && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-foreground uppercase tracking-wider">Internal Thought</div>
                      <div className="text-xs text-foreground leading-relaxed italic bg-secondary p-2 rounded-none border border-input">
                        {activity.thought}
                      </div>
                    </div>
                  )}
                  
                  {activity.action && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-foreground uppercase tracking-wider">Action Taken</div>
                      <div className="text-xs font-mono text-foreground bg-card p-2 rounded-none border border-input">
                        {activity.action}
                      </div>
                    </div>
                  )}

                  {activity.observation && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-foreground uppercase tracking-wider">Observation</div>
                      <div className="text-xs text-muted-foreground bg-secondary p-2 rounded-none">
                        {activity.observation}
                      </div>
                    </div>
                  )}

                  {activity.shared_state && (
                    <StateInspector state={activity.shared_state} />
                  )}

                  <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-border">
                    {showCorrectionInput[activity.id] && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-foreground uppercase">Supervisor Correction</span>
                          <button 
                            onClick={() => setShowCorrectionInput(prev => ({ ...prev, [activity.id]: false }))}
                            className="text-foreground/20 hover:text-muted-foreground"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="relative">
                          <textarea 
                            value={correctionText[activity.id] ?? ''}
                            onChange={(e) => setCorrectionText(prev => ({ ...prev, [activity.id]: e.target.value }))}
                            placeholder="Describe how the agent should have reasoned..."
                            className="w-full bg-card border border-input rounded-none p-2 text-xs text-foreground focus:outline-none focus:border-ring min-h-[60px] resize-none"
                          />
                          <button 
                            onClick={ async () => handleFeedbackClick(activity.id, 'correction')}
                            disabled={isSubmitting[activity.id] ?? !correctionText[activity.id]?.trim()}
                            className="absolute bottom-2 right-2 p-1.5 bg-primary hover:bg-accent text-primary-foreground rounded-none transition-colors disabled:opacity-35"
                          >
                            {isSubmitting[activity.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </div>
                      
                      {onFeedback && (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); void handleFeedbackClick(activity.id, 'positive'); }}
                            disabled={isSubmitting[activity.id]}
                            className={cn(
                              "p-1.5 rounded-none transition-all",
                              feedbackState[activity.id] === 'positive' 
                                ? "bg-primary text-primary-foreground scale-110" 
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                            )}
                            title="Valid reasoning"
                          >
                            <ThumbsUp className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); void handleFeedbackClick(activity.id, 'negative'); }}
                            disabled={isSubmitting[activity.id]}
                            className={cn(
                              "p-1.5 rounded-none transition-all",
                              feedbackState[activity.id] === 'negative' 
                                ? "bg-primary text-primary-foreground" 
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                            )}
                            title="Invalid/Hallucinated"
                          >
                            <ThumbsDown className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); void handleFeedbackClick(activity.id, 'correction'); }}
                            disabled={isSubmitting[activity.id]}
                            className={cn(
                              "flex items-center gap-1 px-2 py-1 rounded-none transition-all text-[10px] font-bold uppercase",
                              feedbackState[activity.id] === 'correction' || showCorrectionInput[activity.id]
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary border border-input text-foreground hover:bg-accent"
                            )}
                          >
                            <MessageSquarePlus className="w-3 h-3" />
                            {isSubmitting[activity.id] ? 'Saving...' : 'Correct'}
                          </button>
                        </div>
                      )}

                      {!onFeedback && activity.metadata && (
                        <div className="text-[10px] text-foreground font-medium">
                          {Object.keys(activity.metadata).length} metadata fields
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {activities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bot className="w-12 h-12 text-border mb-3" />
            <p className="text-sm text-muted-foreground">No agent activity detected yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};
