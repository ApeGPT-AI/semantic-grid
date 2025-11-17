"use client";

import { useEffect } from "react";

const GlobalError = ({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) => {
  useEffect(() => {
    console.error("[GlobalError] A critical error occurred:", error);
    console.error("[GlobalError] Error message:", error.message);
    console.error("[GlobalError] Error stack:", error.stack);
    if (error.digest) {
      console.error("[GlobalError] Error digest:", error.digest);
    }
    // TODO: Send to error tracking service
    // Sentry.captureException(error);

    // Attempt to auto-recover after logging
    const timer = setTimeout(() => {
      reset();
    }, 100);

    return () => clearTimeout(timer);
  }, [error, reset]);

  // Render a minimal fallback with basic HTML (no React components available at this level)
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: "16px", fontFamily: "sans-serif" }}>
        <div style={{ fontSize: "14px", color: "#666" }}>
          A critical error occurred. Check console for details.
        </div>
      </body>
    </html>
  );
};

export default GlobalError;
