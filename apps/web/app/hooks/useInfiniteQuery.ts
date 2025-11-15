import useSWRInfinite from "swr/infinite";

export const UnauthorizedError = new Error("Unauthorized");

type ApiResponse = {
  total_rows: number;
  rows: any[];
};

const fetcher =
  (abortController: AbortController) =>
  async (key: ReturnType<typeof getKey>): Promise<ApiResponse> => {
    // @ts-ignore
    const [url, id, offset, limit, sortBy, sortOrder] = key;

    // Build URL with query params for SSE
    const params = new URLSearchParams();
    if (limit !== undefined) params.append("limit", String(limit));
    if (offset !== undefined) params.append("offset", String(offset));
    if (sortBy) params.append("sort_by", sortBy);
    if (sortOrder) params.append("sort_order", sortOrder);

    // Use Next.js proxy to handle authentication
    const fullUrl = `/api/apegpt/data/sse/${id}${params.toString() ? `?${params.toString()}` : ""}`;

    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(fullUrl);

      // Handle abort signal
      abortController.signal.addEventListener("abort", () => {
        eventSource.close();
        reject(new Error("Aborted"));
      });

      eventSource.addEventListener("count", (e) => {
        const data = JSON.parse(e.data);
        // Count received, could update UI here if needed
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

const getKey = (
  pageIndex: number,
  previousPageData: ApiResponse | null,
  id: string,
  limit: number,
  sortBy?: string,
  sortOrder?: "asc" | "desc",
  sql?: string,
):
  | [string, string, number, number, string?, ("asc" | "desc")?, string?]
  | null => {
  // console.log("getKey", pageIndex, limit);
  if (!id || !sql) return null;
  if (previousPageData && previousPageData.rows.length === 0) return null; // no more pages
  const offset = pageIndex * limit;
  return [
    `/api/apegpt/data`,
    id,
    offset,
    limit,
    sortBy,
    sortOrder /* btoa(sql) */,
  ];
};

export const useInfiniteQuery = ({
  id,
  sql,
  limit = 100,
  sortBy,
  sortOrder,
}: {
  id?: string;
  sql?: string;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) => {
  // console.log("useInfiniteQuery req", id, sortBy, sortOrder);
  const abortController = new AbortController();
  const { data, error, isLoading, size, setSize, mutate, isValidating } =
    useSWRInfinite<ApiResponse>(
      (pageIndex, prevData) =>
        getKey(pageIndex, prevData, id!, limit, sortBy, sortOrder, sql),
      fetcher(abortController),
      {
        revalidateIfStale: false,
        refreshInterval: 0,
        revalidateOnFocus: false,
        // revalidateOnMount: false,
        revalidateOnReconnect: false,
        shouldRetryOnError: false,
      },
    );

  // console.log("useInfiniteQuery res", data, size, isLoading, isValidating);
  const rows = data?.flatMap((page) => page.rows) ?? [];
  const totalRows = data?.[0]?.total_rows ?? 0;
  const isReachingEnd = rows.length >= totalRows;

  return {
    rows,
    totalRows,
    error,
    isLoading,
    // isLoading: isLoading && size === 1,
    // isFetchingMore: isLoading && size > 1,
    isReachingEnd,
    size,
    setSize,
    mutate,
    isValidating,
    abortController,
  };
};
