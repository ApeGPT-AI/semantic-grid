"use client";

import type { ReactNode } from "react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import type { SSEConnectionStatus, SSERequestUpdate } from "@/app/lib/types";

interface SessionContextValue {
  /**
   * Current connection status
   */
  connectionStatus: SSEConnectionStatus;

  /**
   * Latest update received
   */
  latestUpdate: SSERequestUpdate | null;

  /**
   * Error if connection failed
   */
  error: Error | null;

  /**
   * Manually reconnect
   */
  reconnect: () => void;

  /**
   * Manually disconnect
   */
  disconnect: () => void;

  /**
   * Update the session ID (triggers reconnection)
   */
  setSessionId: (sessionId: string | null) => void;

  /**
   * Current session ID
   */
  sessionId: string | null;
}

interface SessionProviderProps {
  children: ReactNode;
  /**
   * Initial session ID (can be changed via setSessionId)
   */
  initialSessionId?: string | null;
  /**
   * Enable SSE connection. If false, no connection is established.
   * Default: true
   */
  enabled?: boolean;
  /**
   * Automatically reconnect on connection errors
   * Default: true
   */
  autoReconnect?: boolean;
  /**
   * Maximum number of reconnection attempts
   * Default: 5
   */
  maxReconnectAttempts?: number;
  /**
   * Delay between reconnection attempts in milliseconds
   * Default: 2000 (2 seconds)
   */
  reconnectDelay?: number;
  /**
   * Callback for status updates
   */
  onUpdate?: (update: SSERequestUpdate) => void;
  /**
   * Callback for connection status changes
   */
  onConnectionChange?: (status: SSEConnectionStatus) => void;
  /**
   * Callback for errors
   */
  onError?: (error: Error) => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(
  undefined,
);

/**
 * Provider component that manages a single SSE connection per app instance
 *
 * @example
 * ```tsx
 * <SessionProvider initialSessionId={sessionId}>
 *   <App />
 * </SessionProvider>
 * ```
 */
export const SessionProvider = ({
  children,
  initialSessionId = null,
  enabled = true,
  autoReconnect = true,
  maxReconnectAttempts = 5,
  reconnectDelay = 2000,
  onUpdate,
  onConnectionChange,
  onError,
}: SessionProviderProps) => {
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [connectionStatus, setConnectionStatus] =
    useState<SSEConnectionStatus>("disconnected");
  const [latestUpdate, setLatestUpdate] = useState<SSERequestUpdate | null>(
    null,
  );
  const [error, setError] = useState<Error | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualDisconnectRef = useRef(false);

  // Stable callback refs to avoid recreating EventSource on callback changes
  const onUpdateRef = useRef(onUpdate);
  const onConnectionChangeRef = useRef(onConnectionChange);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onConnectionChangeRef.current = onConnectionChange;
    onErrorRef.current = onError;
  }, [onUpdate, onConnectionChange, onError]);

  const updateConnectionStatus = useCallback((status: SSEConnectionStatus) => {
    setConnectionStatus(status);
    onConnectionChangeRef.current?.(status);
  }, []);

  const handleError = useCallback((err: Error) => {
    setError(err);
    onErrorRef.current?.(err);
  }, []);

  const connect = useCallback(() => {
    if (!sessionId || !enabled) {
      return;
    }

    // Don't reconnect if manually disconnected
    if (isManualDisconnectRef.current) {
      return;
    }

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      updateConnectionStatus("connecting");
      console.log(`[SessionContext] Connecting to session ${sessionId}`);

      // Create EventSource with credentials to send cookies (Auth0/guest token)
      const eventSource = new EventSource(`/api/apegpt/sse/${sessionId}`, {
        withCredentials: true,
      });
      eventSourceRef.current = eventSource;

      // Handle connection established
      eventSource.addEventListener("connected", (event) => {
        console.log("[SessionContext] Connected:", event.data);
        updateConnectionStatus("connected");
        reconnectAttemptsRef.current = 0; // Reset reconnect counter
        setError(null);
      });

      // Handle request updates
      eventSource.addEventListener("request_update", (event) => {
        try {
          const update: SSERequestUpdate = JSON.parse(event.data);
          console.log("[SessionContext] Request update:", update);

          setLatestUpdate(update);
          onUpdateRef.current?.(update);
        } catch (err) {
          console.error("[SessionContext] Failed to parse update:", err);
          handleError(
            err instanceof Error ? err : new Error("Failed to parse SSE event"),
          );
        }
      });

      // Handle errors from backend
      eventSource.addEventListener("error", (event) => {
        try {
          const errorData = JSON.parse((event as MessageEvent).data);
          console.error("[SessionContext] Server error:", errorData);
          handleError(new Error(errorData.error || "SSE server error"));
        } catch {
          // Not a JSON error event, handle as connection error
          console.error("[SessionContext] Connection error");
        }
      });

      // Handle connection errors (network issues, server down, etc.)
      eventSource.onerror = (event) => {
        console.error("[SessionContext] Connection error:", event);
        updateConnectionStatus("error");

        const err = new Error("SSE connection failed");
        handleError(err);

        // Attempt to reconnect if enabled
        if (
          autoReconnect &&
          reconnectAttemptsRef.current < maxReconnectAttempts &&
          !isManualDisconnectRef.current
        ) {
          reconnectAttemptsRef.current += 1;
          console.log(
            `[SessionContext] Reconnecting (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`,
          );

          // Close current connection
          eventSource.close();

          // Schedule reconnection
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        } else {
          // Max reconnect attempts reached or auto-reconnect disabled
          eventSource.close();
          if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
            console.error(
              "[SessionContext] Max reconnection attempts reached, giving up",
            );
          }
        }
      };
    } catch (err) {
      console.error("[SessionContext] Failed to create EventSource:", err);
      updateConnectionStatus("error");
      handleError(
        err instanceof Error
          ? err
          : new Error("Failed to create SSE connection"),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sessionId,
    enabled,
    autoReconnect,
    maxReconnectAttempts,
    reconnectDelay,
    // Note: updateConnectionStatus and handleError are intentionally excluded
    // to prevent reconnection loops. They are stable via useCallback.
  ]);

  const disconnect = useCallback(() => {
    console.log("[SessionContext] Manually disconnecting");
    isManualDisconnectRef.current = true;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    updateConnectionStatus("disconnected");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // updateConnectionStatus is stable, no need to include it

  const reconnect = useCallback(() => {
    console.log("[SessionContext] Manual reconnect requested");
    isManualDisconnectRef.current = false;
    reconnectAttemptsRef.current = 0;
    disconnect();
    setTimeout(() => connect(), 100);
  }, [connect, disconnect]);

  // Establish connection when sessionId or enabled changes
  useEffect(() => {
    if (sessionId && enabled) {
      isManualDisconnectRef.current = false;
      connect();
    } else {
      disconnect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [sessionId, enabled, connect, disconnect]);

  const value: SessionContextValue = {
    connectionStatus,
    latestUpdate,
    error,
    reconnect,
    disconnect,
    setSessionId,
    sessionId,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
};

/**
 * Hook to access the session SSE connection
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { connectionStatus, latestUpdate, setSessionId } = useSessionContext();
 *
 *   useEffect(() => {
 *     setSessionId(newSessionId);
 *   }, [newSessionId]);
 *
 *   return <div>Status: {connectionStatus}</div>;
 * }
 * ```
 */
export const useSessionContext = (): SessionContextValue => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSessionContext must be used within a SessionProvider");
  }
  return context;
};
