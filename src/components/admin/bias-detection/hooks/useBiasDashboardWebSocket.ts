import { useEffect, useRef } from "react";

import type { Dispatch, MutableRefObject, SetStateAction } from "react";

type WsConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";
type BiasLevel = "all" | "low" | "medium" | "high" | "critical";
type BiasScoreFilter = { min: number; max: number };
type LogFn = (message: string, details?: Record<string, unknown>) => void;
type SetState<T> = Dispatch<SetStateAction<T>>;

interface ExtendedWebSocket extends WebSocket {
  heartbeatInterval?: ReturnType<typeof setInterval>;
}

interface UseBiasDashboardWebSocketOptions {
  enableRealTimeUpdates: boolean;
  wsRef: MutableRefObject<WebSocket | null>;
  selectedTimeRange: string;
  biasScoreFilter: BiasScoreFilter;
  alertLevelFilter: BiasLevel;
  selectedDemographicFilter: string;
  setWsConnectionStatus: SetState<WsConnectionStatus>;
  setWsConnected: SetState<boolean>;
  setWsReconnectAttempts: SetState<number>;
  announceToScreenReader: (message: string) => void;
  logger: {
    info: LogFn;
    error: LogFn;
  };
  onMessage: (event: MessageEvent, socket: WebSocket) => void;
}

export function useBiasDashboardWebSocket({
  enableRealTimeUpdates,
  wsRef,
  selectedTimeRange,
  biasScoreFilter,
  alertLevelFilter,
  selectedDemographicFilter,
  setWsConnectionStatus,
  setWsConnected,
  setWsReconnectAttempts,
  announceToScreenReader,
  logger,
  onMessage,
}: UseBiasDashboardWebSocketOptions): void {
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enableRealTimeUpdates) {
      return;
    }

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 1000;

    const connectWebSocket = () => {
      try {
        setWsConnectionStatus("connecting");
        const wsUrl =
          process.env["NEXT_PUBLIC_WS_URL"] ||
          "ws://localhost:8000/bias-detection";

        const ws = new WebSocket(wsUrl) as ExtendedWebSocket;
        wsRef.current = ws;

        ws.onopen = () => {
          setWsConnected(true);
          setWsConnectionStatus("connected");
          setWsReconnectAttempts(0);
          reconnectAttempts = 0;
          announceToScreenReader("Live updates connection established");
          logger.info("WebSocket connection established", { url: wsUrl });
          ws.send(
            JSON.stringify({
              type: "subscribe",
              channels: [
                "bias_alerts",
                "session_updates",
                "metrics_updates",
                "trends_updates",
              ],
              filters: {
                timeRange: selectedTimeRange,
                biasScoreFilter,
                alertLevelFilter,
              },
            }),
          );
        };

        ws.onclose = (event) => {
          setWsConnected(false);
          announceToScreenReader("Live updates connection closed");
          logger.info("WebSocket connection closed", {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          });

          if (reconnectAttempts < maxReconnectAttempts) {
            setWsConnectionStatus("reconnecting");
            const delay = reconnectDelay * 2 ** reconnectAttempts;
            reconnectAttempts += 1;
            setWsReconnectAttempts(reconnectAttempts);
            logger.info("Attempting to reconnect WebSocket", {
              attempt: reconnectAttempts,
              delay,
              maxAttempts: maxReconnectAttempts,
            });

            if (reconnectTimeoutRef.current != null) {
              clearTimeout(reconnectTimeoutRef.current);
              reconnectTimeoutRef.current = null;
            }
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectTimeoutRef.current = null;
              if (wsRef.current?.readyState === WebSocket.CLOSED) {
                connectWebSocket();
              }
            }, delay);
          } else {
            setWsConnectionStatus("error");
            logger.error("Max WebSocket reconnection attempts reached");
            announceToScreenReader(
              "Live updates failed to reconnect. Please refresh the page.",
            );
          }
        };

        ws.onerror = (error) => {
          setWsConnectionStatus("error");
          setWsConnected(false);
          logger.error("WebSocket error", { error });
          announceToScreenReader("Live updates encountered a connection error");
        };

        ws.onmessage = (event) => {
          onMessage(event, ws);
        };

        const heartbeatInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "heartbeat" }));
          }
        }, 30000);
        ws.heartbeatInterval = heartbeatInterval;
      } catch (error: unknown) {
        setWsConnectionStatus("error");
        logger.error("Failed to create WebSocket connection", { error });
        setWsConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current != null) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        const webSocket = wsRef.current as ExtendedWebSocket;
        if (webSocket.heartbeatInterval) {
          clearInterval(webSocket.heartbeatInterval);
        }
        if (webSocket.readyState === WebSocket.OPEN) {
          try {
            webSocket.send(JSON.stringify({ type: "unsubscribe" }));
          } catch {
            // Ignore unsubscribe errors during shutdown.
          }
        }
        webSocket.close(1000, "Component unmounting");
        wsRef.current = null;
      }
    };
  }, [
    alertLevelFilter,
    biasScoreFilter,
    selectedDemographicFilter,
    onMessage,
    selectedTimeRange,
    setWsConnected,
    setWsConnectionStatus,
    setWsReconnectAttempts,
    announceToScreenReader,
    enableRealTimeUpdates,
    wsRef,
  ]);

  useEffect(() => {
    if (
      enableRealTimeUpdates &&
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN
    ) {
      wsRef.current.send(
        JSON.stringify({
          type: "update_subscription",
          filters: {
            timeRange: selectedTimeRange,
            biasScoreFilter,
            alertLevelFilter,
            demographicFilter: selectedDemographicFilter,
          },
        }),
      );
      logger.info("Updated WebSocket subscription filters", {
        timeRange: selectedTimeRange,
        biasScoreFilter,
        alertLevelFilter,
        demographicFilter: selectedDemographicFilter,
      });
    }
  }, [
    enableRealTimeUpdates,
    selectedTimeRange,
    selectedDemographicFilter,
    alertLevelFilter,
    biasScoreFilter,
    logger,
    wsRef,
  ]);
}

