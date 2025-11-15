import { useCallback, useMemo, useState } from "react";
import useSWR, { unstable_serialize, useSWRConfig } from "swr";

export const UnauthorizedError = new Error("Unauthorized");

const LS_KEY = "app-cache-freshness";

type Freshness = Record<string, number>;

const serializeKey = (key: any) => (key ? unstable_serialize(key) : null);

const readFreshness = (): Freshness => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}") as Freshness;
  } catch {
    return {};
  }
};

export const setFreshness = (key: string, ts = Date.now()) => {
  const f = readFreshness();
  f[key] = ts;
  localStorage.setItem(LS_KEY, JSON.stringify(f));
};

export const getFreshness = (key: string): number | null => {
  const f = readFreshness();
  return typeof f[key] === "number" ? f[key] : null;
};

const fetcher = async ([url, id, limit, offset, sortBy, sortOrder]: [
  url: string,
  id: string,
  limit?: number,
  offset?: number,
  sortBy?: string,
  sortOrder?: "asc" | "desc",
]) => {
  // Build URL with query params
  const params = new URLSearchParams();
  if (limit !== undefined) params.append("limit", String(limit));
  if (offset !== undefined) params.append("offset", String(offset));
  if (sortBy) params.append("sort_by", sortBy);
  if (sortOrder) params.append("sort_order", sortOrder);

  // Use Next.js proxy to handle authentication
  const fullUrl = `/api/apegpt/data/sse/${id}${params.toString() ? `?${params.toString()}` : ""}`;

  return new Promise((resolve, reject) => {
    const eventSource = new EventSource(fullUrl);
    let totalRows = 0;

    eventSource.addEventListener("count", (e) => {
      const data = JSON.parse(e.data);
      totalRows = data.total_rows;
    });

    eventSource.addEventListener("data", (e) => {
      const data = JSON.parse(e.data);
      eventSource.close();
      resolve({
        rows: data.rows,
        total_rows: data.total_rows,
      });
    });

    eventSource.addEventListener("error", (e: any) => {
      const data = e.data ? JSON.parse(e.data) : { error: "Unknown error" };
      eventSource.close();
      reject(new Error(data.error || "Failed to fetch data"));
    });

    eventSource.onerror = (err) => {
      // Only reject if readyState is CLOSED (2)
      // readyState CONNECTING (0) or OPEN (1) means it's still trying/working
      if (eventSource.readyState === EventSource.CLOSED) {
        eventSource.close();
        reject(new Error("Connection closed"));
      }
    };
  });
};

// Remove non-ASCII characters to avoid 400 error from API
const sanitize = (str: string) => str.replace(/[^\x20-\x7E]+/g, "");

export const useQuery = ({
  id,
  sql,
  limit,
  offset,
  sortBy,
  sortOrder,
}: {
  id?: string;
  sql?: string; // not used
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) => {
  const { mutate: mutateCache } = useSWRConfig();
  const [force, setForce] = useState<boolean>(false);

  // console.log("useQuery", id, limit, offset, sortBy, sortOrder);
  // const sqlHash = sql ? btoa(sanitize(sql)) : "";
  const key = id
    ? [`/api/apegpt/data/sse`, id, limit, offset, sortBy, sortOrder]
    : null;
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    key,
    fetcher,
    {
      keepPreviousData: true,
      shouldRetryOnError: false,
      // cacheTime: 0,
      revalidateOnFocus: false,
      revalidateOnMount: true,
      revalidateOnReconnect: false,
      refreshWhenOffline: false,
      refreshWhenHidden: false,
      refreshInterval: 0,
      onSuccess(data, k, c) {
        // console.log("useQuery onSuccess", id, k);
        if (k) setFreshness(k as string);
      },
    },
  );

  const fetchedAt = key ? getFreshness(serializeKey(key) as string) : null;

  const refresh = useCallback(async () => {
    if (!key) return;
    setForce(true);
    try {
      await mutate();
    } finally {
      setForce(false);
      setFreshness(serializeKey(key) as string);
    }
  }, [key]);

  const isRefreshing = useMemo(
    () => force || isValidating,
    [isValidating, force],
  );

  return {
    data,
    error,
    isLoading,
    isValidating,
    isRefreshing,
    mutate,
    mutateCache,
    refresh,
    fetchedAt,
  };
};
