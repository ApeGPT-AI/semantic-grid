import { useEffect } from "react";

interface ApiError {
  message: string;
  status?: number;
  timestamp: number;
}

let errorListeners: ((error: ApiError) => void)[] = [];

/**
 * Global API error notifier
 * Call this from anywhere to log an API error to the console
 */
export const notifyApiError = (message: string, status?: number) => {
  const error: ApiError = {
    message,
    status,
    timestamp: Date.now(),
  };
  errorListeners.forEach((listener) => listener(error));
};

/**
 * Hook to log API errors to console
 * This automatically subscribes to API errors notified via notifyApiError
 */
export const useApiErrorHandler = () => {
  useEffect(() => {
    const listener = (error: ApiError) => {
      console.error("[ApiErrorHandler] API Error:", error.message);
      if (error.status) {
        console.error("[ApiErrorHandler] HTTP Status:", error.status);
      }
      console.error(
        "[ApiErrorHandler] Timestamp:",
        new Date(error.timestamp).toISOString(),
      );
    };

    errorListeners.push(listener);

    return () => {
      errorListeners = errorListeners.filter((l) => l !== listener);
    };
  }, []);

  // Return null - no UI to display
  return null;
};
