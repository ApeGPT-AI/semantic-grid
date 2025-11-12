import { Alert, AlertTitle, IconButton, Snackbar } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useEffect, useState } from "react";

interface ApiError {
  message: string;
  status?: number;
  timestamp: number;
}

let errorListeners: ((error: ApiError) => void)[] = [];

/**
 * Global API error notifier
 * Call this from anywhere to show an API error as a snackbar
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
 * Hook to display API errors as MUI Snackbars
 * This automatically subscribes to API errors notified via notifyApiError
 */
export const useApiErrorHandler = () => {
  const [errors, setErrors] = useState<ApiError[]>([]);

  useEffect(() => {
    const listener = (error: ApiError) => {
      setErrors((prev) => [...prev, error]);
    };

    errorListeners.push(listener);

    return () => {
      errorListeners = errorListeners.filter((l) => l !== listener);
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
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          sx={{ bottom: { xs: 16 + index * 70, sm: 24 + index * 70 } }}
          autoHideDuration={8000}
          onClose={() => handleClose(error.timestamp)}
        >
          <Alert
            severity="warning"
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
            <AlertTitle>
              {error.status ? `API Error (${error.status})` : "API Error"}
            </AlertTitle>
            {error.message}
          </Alert>
        </Snackbar>
      ))}
    </>
  );
};
