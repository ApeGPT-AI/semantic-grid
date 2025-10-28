"use client";

import type { Session } from "@auth0/nextjs-auth0";
import useSWR from "swr";

export const useAuthSession = (user: any) => {
  const fetcher = (url: string) => fetch(url).then((res) => res.json());

  const {
    data: session,
    error,
    isLoading,
  } = useSWR<Session>(user && "/api/auth/session", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  return { session, error, isLoading };
};
