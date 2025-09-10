import React, { useState, useEffect, useRef } from "react";
import type { TherapistSession } from "@/types/dashboard";
import { cn } from "@/lib/utils";

interface SessionControlsProps {
  sessions: TherapistSession[];
  onSessionControl: (sessionId: string, action: 'start' | 'pause' | 'resume' | 'end') => void;
}

export function SessionControls({ sessions, onSessionControl }: SessionControlsProps) {
  const activeSession = sessions.find(session => session.status === 'active');
  const pausedSession = sessions.find(session => session.status === 'paused');

  // Focus management for keyboard navigation
  const [focusedButton, setFocusedButton] = useState<string | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleControlClick = (action: 'start' | 'pause' | 'resume' | 'end', sessionId?: string) => {
    if (sessionId) {
      onSessionControl(sessionId, action);
      // Remove focus after action to prevent accidental repeated clicks
      if (buttonRefs.current[action]) {
        buttonRefs.current[action]?.blur();
      }
    }
  };

  // Keyboard event handling for session controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Blur all buttons when Escape is pressed
        Object.values(buttonRefs.current).forEach(button => {
          button?.blur();
        });
        setFocusedButton(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      className="space-y-4 focus:outline-none"
      role="group"
      aria-label="Session Controls"
      tabIndex={0}
    >
      <h3 className="text-lg font-semibold">Session Controls</h3>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          ref={(el) => { buttonRefs.current['pause'] = el; }}
          onClick={() => activeSession && handleControlClick('pause', activeSession.id)}
          disabled={!activeSession}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
            activeSession
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-200 text-gray-500 cursor-not-allowed"
          )}
          aria-label="Pause current session"
          aria-disabled={!activeSession}
          onFocus={() => setFocusedButton('pause')}
          onBlur={() => setFocusedButton(null)}
        >
          Pause Session
        </button>

        <button
          type="button"
          ref={(el) => { buttonRefs.current['resume'] = el; }}
          onClick={() => pausedSession && handleControlClick('resume', pausedSession.id)}
          disabled={!pausedSession}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
            pausedSession
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-gray-200 text-gray-500 cursor-not-allowed"
          )}
          aria-label="Resume paused session"
          aria-disabled={!pausedSession}
          onFocus={() => setFocusedButton('resume')}
          onBlur={() => setFocusedButton(null)}
        >
          Resume Session
        </button>

        <button
          type="button"
          ref={(el) => { buttonRefs.current['end'] = el; }}
          onClick={() => activeSession && handleControlClick('end', activeSession.id)}
          disabled={!activeSession}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
            activeSession
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-gray-200 text-gray-500 cursor-not-allowed"
          )}
          aria-label="End current session"
          aria-disabled={!activeSession}
          onFocus={() => setFocusedButton('end')}
          onBlur={() => setFocusedButton(null)}
        >
          End Session
        </button>
      </div>

      {/* Session List */}
      <div className="space-y-2" role="region" aria-label="Recent Sessions">
        <h4 className="text-md font-medium">Recent Sessions</h4>
        {sessions.length === 0 ? (
          <div className="text-sm text-muted-foreground italic p-4 text-center">
            No recent sessions available
          </div>
        ) : (
          <ul className="space-y-2" role="list">
            {sessions.slice(0, 3).map((session) => (
              <li
                key={session.id}
                className={cn(
                  "flex items-center justify-between p-3 bg-background rounded border transition-colors",
                  "hover:bg-muted/50"
                )}
                role="listitem"
                aria-label={`Session ${session.id.slice(0, 8)}, status: ${session.status}`}
              >
                <div>
                  <div className="text-sm font-medium">Session {session.id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(session.startTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  {session.endTime && (
                    <div className="text-xs text-muted-foreground">
                      Ended: {new Date(session.endTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  )}
                </div>
                <span className={cn(
                  "px-2 py-1 text-xs rounded-full whitespace-nowrap",
                  session.status === 'active' && "bg-green-100 text-green-800",
                  session.status === 'paused' && "bg-yellow-100 text-yellow-800",
                  session.status === 'completed' && "bg-blue-100 text-blue-800",
                  session.status === 'cancelled' && "bg-red-100 text-red-800"
                )}>
                  {session.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default SessionControls;
