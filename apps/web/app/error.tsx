"use client";

import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Collapse,
  Container,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

const Error = ({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) => {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.error("[Error]", error);
    // TODO: Send to error tracking service
    // Sentry.captureException(error);
  }, [error]);

  const handleToggleDetails = () => {
    setShowDetails((prev) => !prev);
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Alert
        severity="error"
        sx={{ mb: 2 }}
        action={
          <Button color="inherit" size="small" onClick={reset}>
            Try Again
          </Button>
        }
      >
        <AlertTitle>Something went wrong</AlertTitle>
        <Typography variant="body2" sx={{ mb: 1 }}>
          An unexpected error occurred. You can try again or refresh the page if
          the problem persists.
        </Typography>
        {error.message && (
          <Typography
            variant="body2"
            sx={{
              fontFamily: "monospace",
              fontSize: "0.875rem",
              color: "error.dark",
              mb: 1,
              p: 1,
              bgcolor: "error.lighter",
              borderRadius: 1,
            }}
          >
            {error.message}
          </Typography>
        )}
        <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
          <Button size="small" variant="outlined" onClick={handleToggleDetails}>
            {showDetails ? "Hide" : "Show"} Details
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => window.location.reload()}
          >
            Reload Page
          </Button>
        </Box>
      </Alert>

      <Collapse in={showDetails}>
        <Box
          sx={{
            p: 2,
            bgcolor: "grey.900",
            color: "grey.100",
            borderRadius: 1,
            fontFamily: "monospace",
            fontSize: "0.75rem",
            overflowX: "auto",
            maxHeight: 400,
            overflowY: "auto",
          }}
        >
          <Typography
            variant="body2"
            sx={{ mb: 2, fontWeight: "bold", color: "inherit" }}
          >
            Error Stack:
          </Typography>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {error?.stack || "No stack trace available"}
          </pre>

          {error.digest && (
            <Typography
              variant="body2"
              sx={{ mt: 3, mb: 1, fontWeight: "bold", color: "inherit" }}
            >
              Error Digest: {error.digest}
            </Typography>
          )}
        </Box>
      </Collapse>
    </Container>
  );
};

export default Error;
