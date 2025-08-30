// import { getSession } from "@auth0/nextjs-auth0/edge";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    {
      source: "/((?!mcp|api|.well-known|_next/static|_next/image|.*\\..*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

export async function middleware(req: NextRequest) {
  const host = req.headers.get("host");
  const schema = req.headers.get("x-forwarded-proto") || "http";
  console.log("middleware", schema, host, req.nextUrl.pathname);
  const freeRequests = Number(cookies().get("apegpt-trial")?.value || 0);
  const guestToken = cookies().get("uid")?.value;
  console.log("guestToken", guestToken, freeRequests);

  // make sure ephemeral requests are not impacted
  if (req.nextUrl.pathname.endsWith("/api/auth/guest")) {
    return NextResponse.next();
  }

  // anyone is allowed for home page and data queries
  if (req.nextUrl.pathname.startsWith("/q/")) {
    return NextResponse.next();
  }

  if (req.nextUrl.pathname === "/") {
    return NextResponse.redirect(`${schema}://${host}/query`);
  }

  /*
  let session;
  try {
    session = await getSession(req, new NextResponse());
    const expired = (session?.accessTokenExpiresAt || 0) * 1000 < Date.now();
    console.log(
      "user session",
      !!session,
      "user",
      !!session?.user,
      "expired",
      expired,
    );
    if (expired) {
      return NextResponse.redirect(`${schema}://${host}/api/auth/login`, {
        // @ts-ignore
        method: "GET",
      });
    }
  } catch (_) {
    console.log("no user session");
  }

  // 1. we check if the user is Auth0 authenticated
  if (session && session?.user) {
    // if the user is not an admin, we redirect them to the chat page
    if (
      req.nextUrl.pathname.startsWith("/admin/") &&
      !session.accessTokenScope?.includes("admin:")
    ) {
      return NextResponse.redirect(`${schema}://${host}/chat`);
    }
    return NextResponse.next();
  }
   */

  // 2. we check if the user is a guest
  if (!guestToken) {
    console.log("Guest token not found", host);
    return NextResponse.redirect(`${schema}://${host}/api/auth/guest`);
  }

  // 3. we check if the user has free requests left
  const freeTierQuota = process.env.FREE_TIER_QUOTA || "0";
  if (freeRequests < Number(freeTierQuota)) {
    console.log("has free requests left");
    return NextResponse.next();
  }

  // 4. if the user is not authenticated, not a guest, and has no free requests left, we redirect them to the login page
  console.log("No quota, redirecting to login", host);
  return NextResponse.redirect(`${schema}://${host}/api/auth/login`);
}
