import React from "react";
import type { TherapistSession } from "@/types/dashboard";
import { cn } from "@/lib/utils";

interface SessionControlsProps {
  sessions: TherapistSession[];
  onSessionControl: (sessionId: string, action: 'start' | 'pause' | 'resume' | 'end') => void;
}

export function SessionControls({ sessions, onSessionControl }: SessionControlsProps) {
  const activeSession = sessions.find(session => session.status === 'active');
  const pausedSession = sessions.find(session => session.status === 'paused');

  const handleControlClick = (action: 'start' | 'pause' | 'resume' | 'end', sessionId?: string) => {
    if (sessionId) {
      onSessionControl(sessionId, action);
    }
  };

  return (
    <div className="space-y-4" role="group" aria-label="Session Controls">
      <h3 className="text-lg font-semibold">Session Controls</h3>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => activeSession && handleControlClick('pause', activeSession.id)}
          disabled={!activeSession}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-colors",
            activeSession
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-200 text-gray-500 cursor-not-allowed"
          )}
          aria-label="Pause current session"
        >
          Pause Session
        </button>

        <button
          onClick={() => pausedSession && handleControlClick('resume', pausedSession.id)}
          disabled={!pausedSession}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-colors",
            pausedSession
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-gray-200 text-gray-500 cursor-not-allowed"
          )}
          aria-label="Resume paused session"
        >
          Resume Session
        </button>

        <button
          onClick={() => activeSession && handleControlClick('end', activeSession.id)}
          disabled={!activeSession}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-colors",
            activeSession
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-gray-200 text-gray-500 cursor-not-allowed"
          )}
          aria-label="End current session"
        >
          End Session
        </button>
      </div>

      {/* Session List */}
      <div className="space-y-2">
        <h4 className="text-md font-medium">Recent Sessions</h4>
        {sessions.slice(0, 3).map((session) => (
          <div
            key={session.id}
            className="flex items-center justify-between p-2 bg-background rounded border"
          >
            <div>
              <div className="text-sm font-medium">Session {session.id.slice(0, 8)}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(session.startTime).toLocaleTimeString()}
              </div>
            </div>
            <span className={cn(
              "px-2 py-1 text-xs rounded-full",
              session.status === 'active' && "bg-green-100 text-green-800",
              session.status === 'paused' && "bg-yellow-100 text-yellow-800",
              session.status === 'completed' && "bg-blue-100 text-blue-800",
              session.status === 'cancelled' && "bg-red-100 text-red-800"
            )}>
              {session.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SessionControls;
