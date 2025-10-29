import useSWRInfinite from "swr/infinite";

export const UnauthorizedError = new Error("Unauthorized");

type ApiResponse = {
  total_rows: number;
  rows: any[];
};

const ORIGIN_BASE = process.env.APEGPT_API_URL ?? "https://api.apegpt.ai"; // e.g. https://api.example.com

const fetcher =
  (abortController: AbortController) =>
  async (key: ReturnType<typeof getKey>): Promise<ApiResponse> => {
    // @ts-ignore
    const [url, id, offset, limit, sortBy, sortOrder] = key;

    let fullUrl = `${url}/${id}`;
    const params = new URLSearchParams();
    if (limit !== undefined) params.append("limit", String(limit));
    if (offset !== undefined) params.append("offset", String(offset));
    if (sortBy) params.append("sort_by", sortBy);
    if (sortOrder) params.append("sort_order", sortOrder);
    if ([...params].length > 0) fullUrl += `?${params.toString()}`;

    const res = await fetch(fullUrl, { signal: abortController.signal });
    if (!res.ok) throw UnauthorizedError;

    return res.json();
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
  return [ORIGIN_BASE, id, offset, limit, sortBy, sortOrder /* btoa(sql) */];
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
