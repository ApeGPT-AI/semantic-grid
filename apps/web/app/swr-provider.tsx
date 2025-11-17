"use client";

import { SWRConfig } from "swr";

import { localStorageProvider } from "@/app/contexts/localStorageProvider";

const SWRProvider = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig
    value={{
      provider: () => localStorageProvider() as any,
      // Prevent infinite retry loops on API errors
      shouldRetryOnError: false,
      // Limit error retries to 3 attempts
      errorRetryCount: 3,
      // Exponential backoff: 1s, 2s, 4s
      errorRetryInterval: 1000,
      // Don't revalidate on focus if there was an error
      revalidateOnFocus: false,
      // Don't revalidate on reconnect if there was an error
      revalidateOnReconnect: false,
      // Dedupe requests within 2 seconds
      dedupingInterval: 2000,
      // Custom error handler to log but not crash
      onError: (error, key) => {
        console.error(`[SWR Error] ${key}:`, error);
        // Don't throw - just log
      },
    }}
  >
    {children}
  </SWRConfig>
);

export default SWRProvider;
