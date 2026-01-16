import { useCallback, useEffect, useRef, useState } from "react";

export type EmotionProbabilities = Record<string, number>

export interface AudioEmotion {
    valence: number
    arousal: number
    dominance?: number
    primary_emotion?: string
    confidence?: number
    emotion_probabilities?: EmotionProbabilities
}

export interface TextEmotion {
    eq_scores: number[]
    overall_eq: number
    confidence?: number
}

export interface FusedEmotion {
    eq_scores: number[]
    overall_eq: number
    valence?: number
    arousal?: number
    dominance?: number
    conflict_score?: number
    confidence?: number
    text_contribution?: number
    audio_contribution?: number
}

export interface MultimodalInferenceResponse {
    response?: string
    transcription?: string
    text_emotion?: TextEmotion
    audio_emotion?: AudioEmotion
    fused_emotion?: FusedEmotion
    conflict_detected?: boolean
    latency_ms?: number
    audio_url?: string
    warning?: string
}

export interface UseMultimodalPixelOptions {
    endpoint?: string
    textOnlyEndpoint?: string
    defaultContextType?: string
    streamUrl?: string
}

export interface UseMultimodalPixelState {
    loading: boolean
    error: string | null
    lastResponse: MultimodalInferenceResponse | null
    transcription: string | null
    textEmotion: TextEmotion | null
    audioEmotion: AudioEmotion | null
    fusedEmotion: FusedEmotion | null
    conflictDetected: boolean
    latencyMs: number | null

    // Streaming
    streaming: boolean
    streamStatus: string | null
    streamError: string | null
}

export interface MultimodalInferArgs {
    text: string
    audioBlob?: Blob | null
    sessionId?: string
    contextType?: string
}

export interface MultimodalStreamConfig {
  sessionId?: string;
  contextType?: string;
  text?: string;
}

export function useMultimodalPixel(options: UseMultimodalPixelOptions = {}) {
  const {
    endpoint = "/api/ai/pixel/infer-multimodal",
    textOnlyEndpoint = "/api/ai/pixel/infer",
    defaultContextType = "therapeutic",
  } = options;

  let streamUrl = options.streamUrl;
  if (streamUrl === undefined && typeof window !== "undefined") {
    try {
      streamUrl =
        (import.meta.env?.PUBLIC_PIXEL_WS_URL as string | undefined) ||
        `${window.location.origin.replace("http", "ws")}/api/websocket/pixel-multimodal`;
    } catch {
      streamUrl = `${window.location.origin.replace("http", "ws")}/api/websocket/pixel-multimodal`;
    }
  }

  const abortRef = useRef<AbortController | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamConfigRef = useRef<MultimodalStreamConfig>({});
  const [state, setState] = useState<UseMultimodalPixelState>({
    loading: false,
    error: null,
    lastResponse: null,
    transcription: null,
    textEmotion: null,
    audioEmotion: null,
    fusedEmotion: null,
    conflictDetected: false,
    latencyMs: null,
    streaming: false,
    streamStatus: null,
    streamError: null,
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const reset = useCallback(() => {
    setState({
      loading: false,
      error: null,
      lastResponse: null,
      transcription: null,
      textEmotion: null,
      audioEmotion: null,
      fusedEmotion: null,
      conflictDetected: false,
      latencyMs: null,
      streaming: false,
      streamStatus: null,
      streamError: null,
    });
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  const disconnectStream = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      streaming: false,
      streamStatus: "disconnected",
    }));
  }, []);

  const connectStream = useCallback(
    (config: MultimodalStreamConfig = {}) => {
      if (!streamUrl) {
        setState((prev) => ({
          ...prev,
          streamError: "Streaming URL not configured",
        }));
        return;
      }

      try {
        streamConfigRef.current = config;
        const ws = new WebSocket(streamUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setState((prev) => ({
            ...prev,
            streaming: true,
            streamStatus: "connected",
            streamError: null,
          }));
        };

        ws.onclose = () => {
          setState((prev) => ({
            ...prev,
            streaming: false,
            streamStatus: "closed",
          }));
        };

        ws.onerror = () => {
          setState((prev) => ({
            ...prev,
            streaming: false,
            streamStatus: "error",
            streamError: "WebSocket error",
          }));
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as Record<string, unknown>;
            const type = payload.type as string;
            if (type === "status") {
              setState((prev) => ({
                ...prev,
                streamStatus: (payload.status as string) || prev.streamStatus,
              }));
            } else if (type === "result") {
              const data = payload.data as MultimodalInferenceResponse;
              setState((prev) => ({
                ...prev,
                lastResponse: data,
                transcription: data?.transcription || null,
                textEmotion: data?.text_emotion || null,
                audioEmotion: data?.audio_emotion || null,
                fusedEmotion: data?.fused_emotion || null,
                conflictDetected: Boolean(
                  data?.conflict_detected ||
                  (data?.fused_emotion?.conflict_score &&
                    data.fused_emotion.conflict_score > 0.5),
                ),
                latencyMs: data?.latency_ms || prev.latencyMs,
                streamStatus: "result",
              }));
            } else if (type === "error") {
              setState((prev) => ({
                ...prev,
                streamError: (payload.message as string) || "Stream error",
                streamStatus: "error",
              }));
            }
          } catch (err) {
            setState((prev) => ({
              ...prev,
              streamError:
                err instanceof Error ? err.message : "Malformed message",
              streamStatus: "error",
            }));
          }
        };
      } catch (err) {
        setState((prev) => ({
          ...prev,
          streamError:
            err instanceof Error ? err.message : "Stream init failed",
          streamStatus: "error",
        }));
      }
    },
    [streamUrl],
  );

  const sendTextToStream = useCallback(
    (text: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      wsRef.current.send(
        JSON.stringify({
          type: "text",
          text,
          contextType:
            streamConfigRef.current.contextType || defaultContextType,
          sessionId: streamConfigRef.current.sessionId,
        }),
      );
    },
    [defaultContextType],
  );

  const sendChunkToStream = useCallback(
    async (chunk: Blob, mimeType = "audio/webm") => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      const base64 = await blobToBase64(chunk);
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      wsRef.current.send(
        JSON.stringify({
          type: "chunk",
          chunk: base64,
          mimeType,
          sessionId: streamConfigRef.current.sessionId,
        }),
      );
    },
    [],
  );

  const finalizeStream = useCallback(
    ({ text, sessionId, contextType }: MultimodalStreamConfig = {}) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      wsRef.current.send(
        JSON.stringify({
          type: "complete",
          text,
          sessionId: sessionId || streamConfigRef.current.sessionId,
          contextType:
            contextType ||
            streamConfigRef.current.contextType ||
            defaultContextType,
        }),
      );
    },
    [defaultContextType],
  );

  const infer = useCallback(
    async (
      args: MultimodalInferArgs,
    ): Promise<MultimodalInferenceResponse | null> => {
      const { text, audioBlob, sessionId, contextType } = args;

      if (!text && !audioBlob) {
        setState((prev) => ({
          ...prev,
          error: "Text or audio is required",
        }));
        return null;
      }

      // Abort previous request
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();

      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
      }));

      const start = performance.now();

      try {
        // When no audio, fallback to text-only endpoint for better latency
        if (!audioBlob) {
          const response = await fetch(textOnlyEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              user_query: text,
              context_type: contextType || defaultContextType,
              session_id: sessionId,
            }),
            signal: abortRef.current.signal,
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
              errorData.message || `API error: ${response.status}`,
            );
          }

          const json = (await response.json()) as MultimodalInferenceResponse;
          const latency = performance.now() - start;

          setState((prev) => ({
            ...prev,
            loading: false,
            error: null,
            lastResponse: json,
            transcription: json.transcription || null,
            textEmotion: json.text_emotion || null,
            audioEmotion: json.audio_emotion || null,
            fusedEmotion: json.fused_emotion || null,
            conflictDetected: Boolean(
              json.conflict_detected ||
              (json.fused_emotion?.conflict_score &&
                json.fused_emotion.conflict_score > 0.5),
            ),
            latencyMs: latency,
          }));

          return json;
        }

        const form = new FormData();
        form.append("text", text);
        form.append("context_type", contextType || defaultContextType);
        if (sessionId) form.append("session_id", sessionId);
        form.append("audio", audioBlob, "audio.webm");

        const response = await fetch(endpoint, {
          method: "POST",
          body: form,
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `API error: ${response.status}`);
        }

        const json = (await response.json()) as MultimodalInferenceResponse;
        const latency = performance.now() - start;

        setState((prev) => ({
          ...prev,
          loading: false,
          error: null,
          lastResponse: json,
          transcription: json.transcription || null,
          textEmotion: json.text_emotion || null,
          audioEmotion: json.audio_emotion || null,
          fusedEmotion: json.fused_emotion || null,
          conflictDetected: Boolean(
            json.conflict_detected ||
            (json.fused_emotion?.conflict_score &&
              json.fused_emotion.conflict_score > 0.5),
          ),
          latencyMs: latency,
        }));

        return json;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Inference failed";
        setState((prev) => ({
          ...prev,
          loading: false,
          error: message,
        }));
        return null;
      }
    },
    [defaultContextType, endpoint, textOnlyEndpoint],
  );

  return {
    infer,
    cancel,
    reset,
    connectStream,
    disconnectStream,
    sendChunkToStream,
    sendTextToStream,
    finalizeStream,
    ...state,
  };
}

async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
            const { result } = reader
            if (typeof result === 'string') {
                const base64 = result.split(',')[1] || ''
                resolve(base64)
            } else {
                reject(new Error('Failed to convert blob to base64'))
            }
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
    })
}
