"use client";

import { Button, Container, Typography } from "@mui/material";
import { useEffect } from "react";

const GlobalError = ({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) => {
  useEffect(() => {
    console.error("[GlobalError]", error);
    // TODO: Send to error tracking service
    // Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          backgroundColor: "#f5f5f5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <Container
          maxWidth="sm"
          style={{
            textAlign: "center",
            padding: "2rem",
            backgroundColor: "white",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>⚠️</div>
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            style={{ fontWeight: 600 }}
          >
            Something went wrong
          </Typography>
          <Typography
            variant="body1"
            color="textSecondary"
            paragraph
            style={{ marginBottom: "1.5rem" }}
          >
            An unexpected error occurred. This could be due to a temporary
            issue. Please try refreshing the page.
          </Typography>
          {error.message && (
            <Typography
              variant="body2"
              style={{
                fontFamily: "monospace",
                backgroundColor: "#f5f5f5",
                padding: "1rem",
                borderRadius: "4px",
                marginBottom: "1.5rem",
                color: "#d32f2f",
                wordBreak: "break-word",
              }}
            >
              {error.message}
            </Typography>
          )}
          <div
            style={{ display: "flex", gap: "1rem", justifyContent: "center" }}
          >
            <Button
              variant="contained"
              color="primary"
              onClick={reset}
              style={{ textTransform: "none" }}
            >
              Try Again
            </Button>
            <Button
              variant="outlined"
              onClick={() => window.location.reload()}
              style={{ textTransform: "none" }}
            >
              Reload Page
            </Button>
          </div>
        </Container>
      </body>
    </html>
  );
};

export default GlobalError;
