"use client";

import { Alert, AlertTitle, IconButton, Snackbar } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useEffect, useState } from "react";

interface ErrorInfo {
  message: string;
  timestamp: number;
}

/**
 * Global error handler that catches unhandled errors and promise rejections
 * and displays them as MUI Snackbar alerts at the bottom of the screen.
 */
const GlobalErrorHandler = () => {
  const [errors, setErrors] = useState<ErrorInfo[]>([]);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      event.preventDefault();
      const errorMessage =
        event.error?.message || event.message || "An unknown error occurred";
      console.error(
        "[GlobalErrorHandler] Uncaught error:",
        event.error || event.message,
      );

      setErrors((prev) => [
        ...prev,
        {
          message: errorMessage,
          timestamp: Date.now(),
        },
      ]);

      // TODO: Send to error tracking service
      // Sentry.captureException(event.error);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      const errorMessage =
        event.reason?.message ||
        String(event.reason) ||
        "An unhandled promise rejection occurred";
      console.error("[GlobalErrorHandler] Unhandled rejection:", event.reason);

      setErrors((prev) => [
        ...prev,
        {
          message: errorMessage,
          timestamp: Date.now(),
        },
      ]);

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

  const handleClose = (timestamp: number) => {
    setErrors((prev) => prev.filter((err) => err.timestamp !== timestamp));
  };

  return (
    <>
      {errors.map((error, index) => (
        <Snackbar
          key={error.timestamp}
          open
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          sx={{ bottom: { xs: 16 + index * 70, sm: 24 + index * 70 } }}
          autoHideDuration={10000}
          onClose={() => handleClose(error.timestamp)}
        >
          <Alert
            severity="error"
            variant="filled"
            onClose={() => handleClose(error.timestamp)}
            action={
              <IconButton
                size="small"
                aria-label="close"
                color="inherit"
                onClick={() => handleClose(error.timestamp)}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
            sx={{ width: "100%", maxWidth: 500 }}
          >
            <AlertTitle>Error</AlertTitle>
            {error.message}
          </Alert>
        </Snackbar>
      ))}
    </>
  );
};

export default GlobalErrorHandler;
