"use client";

import { useEffect } from "react";

const Error = ({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) => {
  useEffect(() => {
    console.error("[Error] An error occurred:", error);
    console.error("[Error] Error message:", error.message);
    console.error("[Error] Error stack:", error.stack);
    if (error.digest) {
      console.error("[Error] Error digest:", error.digest);
    }
    // TODO: Send to error tracking service
    // Sentry.captureException(error);

    // Attempt to auto-recover after logging
    const timer = setTimeout(() => {
      reset();
    }, 100);

    return () => clearTimeout(timer);
  }, [error, reset]);

  // Render a minimal fallback that doesn't obstruct the UI
  return (
    <div style={{ padding: "8px", fontSize: "12px", color: "#666" }}>
      An error occurred. Check console for details.
    </div>
  );
};

export default Error;
