"use client";

import { useApiErrorHandler } from "@/app/hooks/useApiErrorHandler";

/**
 * Client component wrapper for API error handler
 * This must be a separate component since useApiErrorHandler is a hook
 */
const ApiErrorHandler = () => {
  useApiErrorHandler();
  return null;
};

export default ApiErrorHandler;
