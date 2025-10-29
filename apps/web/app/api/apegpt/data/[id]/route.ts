import { getAccessToken } from "@auth0/nextjs-auth0";
import { cookies, headers as nextHeaders } from "next/headers";
import type { NextRequest } from "next/server";

const ORIGIN_BASE = process.env.APEGPT_API_URL ?? "https://api.apegpt.ai"; // e.g. https://api.example.com

export const GET = async (
  req: NextRequest,
  { params: { id } }: { params: { id: string } },
) => {
  // 1) Auth
  const guestToken = cookies().get("uid")?.value;
  let token: { accessToken?: string } | null = null;
  try {
    token = await getAccessToken();
  } catch {
    token = { accessToken: guestToken };
  }
  if (!token?.accessToken) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2) Build upstream URL (preserve query string)
  const url = new URL(`${ORIGIN_BASE}/api/v1/data/${id}`);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  // 3) Forward conditional header (If-None-Match) so origin can 304
  const incoming = nextHeaders();
  const ifNoneMatch = incoming.get("if-none-match") ?? undefined;

  // 4) Fetch origin WITHOUT forcing no-store
  const upstream = await fetch(url.toString(), {
    method: "GET",
    headers: {
      // Authorization: `Bearer ${token.accessToken}`,
      ...(ifNoneMatch ? { "If-None-Match": ifNoneMatch } : {}),
      // If your origin varies by Accept-Encoding, keep it default; no need to set here.
    },
    // IMPORTANT: don’t set cache: 'no-store' — we want browser caching+revalidation
  });

  // 5) Pass through headers (allowlist the important caching ones)
  const h = new Headers();
  // Cache semantics for SWR
  const cacheControl = upstream.headers.get("cache-control");
  const etag = upstream.headers.get("etag");
  const vary = upstream.headers.get("vary");

  if (cacheControl) h.set("Cache-Control", cacheControl);
  if (etag) h.set("ETag", etag);
  if (vary) h.set("Vary", vary);
  // Content type
  const ct =
    upstream.headers.get("content-type") ?? "application/json; charset=utf-8";
  h.set("Content-Type", ct);

  // Optional: expose ETag to client JS (not strictly needed for SWR)
  h.set("Access-Control-Expose-Headers", "ETag, Cache-Control");

  // 6) If origin says 304, forward 304 with no body
  if (upstream.status === 304) {
    return new Response(null, { status: 304, headers: h });
  }

  // 7) Otherwise stream the body through unchanged
  return new Response(upstream.body, {
    status: upstream.status,
    headers: h,
  });
};
