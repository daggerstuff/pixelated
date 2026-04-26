import { useState, useCallback, useRef } from 'react';
import type { AgentActivity, Message } from '@/types/chat';

interface StreamOptions {
  onActivity?: (activity: AgentActivity) => void;
  onFinalResponse?: (response: any) => void;
  onError?: (error: Error) => void;
}

export function useAgentThoughtStream() {
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const streamInference = useCallback(async (
    userQuery: string, 
    history: Message[] = [],
    options: StreamOptions = {}
  ) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsStreaming(true);
    setActivities([]);
    setError(null);

    try {
      // In development, this might need to point to your Python port (e.g., 8001)
      // or be proxied through your Astro/Vite config
      const response = await fetch('/api/ai/pixel/infer-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_query: userQuery,
          conversation_history: history,
          include_metrics: true,
          use_eq_awareness: true,
          gestalt_directive: (options as any).gestaltDirective
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (!part.trim()) continue;

          const lines = part.split('\n');
          let eventType = '';
          let dataStr = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7);
            } else if (line.startsWith('data: ')) {
              dataStr = line.slice(6);
            }
          }

          try {
            const data = JSON.parse(dataStr);
            
            if (eventType === 'activity') {
              const activity = data as AgentActivity;
              setActivities(prev => [...prev, activity]);
              options.onActivity?.(activity);
            } else if (eventType === 'final_response') {
              setIsStreaming(false);
              options.onFinalResponse?.(data);
            } else if (eventType === 'error') {
              throw new Error(data.detail || 'Unknown streaming error');
            }
          } catch (e) {
            console.error('Failed to parse SSE message', e);
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err);
      setIsStreaming(false);
      options.onError?.(err);
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  }, []);

  return {
    activities,
    isStreaming,
    error,
    streamInference,
    stopStreaming,
    clearActivities: () => setActivities([])
  };
}
