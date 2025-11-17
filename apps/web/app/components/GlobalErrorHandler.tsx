"use client";

import { useEffect } from "react";

/**
 * Global error handler that catches unhandled errors and promise rejections
 * and logs them to the console (no UI display).
 */
const GlobalErrorHandler = () => {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      event.preventDefault();
      console.error(
        "[GlobalErrorHandler] Uncaught error:",
        event.error || event.message,
      );
      console.error(
        "[GlobalErrorHandler] Error message:",
        event.error?.message || event.message,
      );
      if (event.error?.stack) {
        console.error("[GlobalErrorHandler] Error stack:", event.error.stack);
      }
      console.error("[GlobalErrorHandler] Error location:", {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });

      // TODO: Send to error tracking service
      // Sentry.captureException(event.error);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      console.error(
        "[GlobalErrorHandler] Unhandled promise rejection:",
        event.reason,
      );
      if (event.reason?.message) {
        console.error(
          "[GlobalErrorHandler] Rejection message:",
          event.reason.message,
        );
      }
      if (event.reason?.stack) {
        console.error(
          "[GlobalErrorHandler] Rejection stack:",
          event.reason.stack,
        );
      }

      // TODO: Send to error tracking service
      // Sentry.captureException(event.reason);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
    };
  }, []);

  // Return null - no UI to display
  return null;
};

export default GlobalErrorHandler;
