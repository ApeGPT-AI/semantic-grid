import useSWR from "swr";

export const UnauthorizedError = new Error("Unauthorized");

export const useUserSession = (sessionId: string) => {
  const fetcher = (url: string) =>
    fetch(url).then((res) => {
      if (res.ok) return res.json();
      throw UnauthorizedError;
    });
  const { data, error, isLoading, mutate } = useSWR(
    `/api/apegpt/sessions/${sessionId}`,
    fetcher,
    {
      shouldRetryOnError: false,
      // cacheTime: 0,
      revalidateOnFocus: false,
      revalidateOnMount: true,
      revalidateOnReconnect: false,
      refreshWhenOffline: false,
      refreshWhenHidden: false,
      refreshInterval: 0,
    },
  );

  return { data, error, isLoading, mutate };
};
