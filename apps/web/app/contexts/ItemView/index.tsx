"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ViewKey = "chart" | "grid" | "sql";
const VIEW_KEYS: ViewKey[] = ["chart", "grid", "sql"];

type Ctx = {
  view: ViewKey;
  setView: (next: ViewKey) => void;
  itemId: string;
};

function useBaseUrl() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return useMemo(() => {
    const qs = searchParams?.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, searchParams]);
}

function readHash(): ViewKey | null {
  if (typeof window === "undefined") return null;
  const h = window.location.hash.replace(/^#/, "");
  console.log("readHash", h);
  return VIEW_KEYS.includes(h as ViewKey) ? (h as ViewKey) : null;
}

export const Index = createContext<Ctx | null>(null);

export const ItemViewProvider = ({
  itemId,
  defaultView = "chart",
  children,
}: {
  itemId: string;
  defaultView?: ViewKey;
  children: React.ReactNode;
}) => {
  const router = useRouter();
  const baseUrl = useBaseUrl();

  const readLocal = (): ViewKey | null => {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem(`itemView:${itemId}`);
    return VIEW_KEYS.includes(v as ViewKey) ? (v as ViewKey) : null;
  };

  const hash = readHash();
  console.log("ItemViewProvider", itemId, hash);

  // Resolve initial state (hash > localStorage > default)
  const initial = (readHash() ?? readLocal() ?? defaultView) as ViewKey;
  const [view, setViewState] = useState<ViewKey>(initial);

  // Ensure URL reflects the resolved initial view on mount
  useEffect(() => {
    if (!readHash()) {
      router.replace(`${baseUrl}#${view}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep state in sync with manual hash edits + back/forward
  useEffect(() => {
    const onHash = () => {
      const h = readHash();
      if (h && h !== view) setViewState(h);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [view]);

  // Cross-tab sync: if another tab changes localStorage, update here (and URL)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === `itemView:${itemId}` && e.newValue) {
        const nv = e.newValue as ViewKey;
        if (VIEW_KEYS.includes(nv) && nv !== view) {
          setViewState(nv);
          router.replace(`${baseUrl}#${nv}`, { scroll: false });
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [itemId, baseUrl, router, view]);

  const setView = (next: ViewKey) => {
    if (!VIEW_KEYS.includes(next)) return;
    setViewState(next);
    // Update URL fragment (no RSC refetch), also persist per item
    router.replace(`${baseUrl}#${next}`, { scroll: false });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`itemView:${itemId}`, next);
    }
  };

  const value = useMemo(() => ({ view, setView, itemId }), [view, itemId]);

  return <Index.Provider value={value}>{children}</Index.Provider>;
};

// Consumer hook
export function useItemViewContext() {
  const ctx = useContext(Index);
  if (!ctx)
    throw new Error("useItemViewContext must be used within a Provider");
  return ctx;
}
