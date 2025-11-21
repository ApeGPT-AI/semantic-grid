import "server-only";

import type { Session } from "@auth0/nextjs-auth0";
import { getSession } from "@auth0/nextjs-auth0";
import { jwtDecode } from "jwt-decode";
import { cookies } from "next/headers";
import { cache } from "react";

export const getUserAuthSession = cache(
  async (): Promise<Session | null | undefined> => {
    const session = await getSession();

    if (!session) {
      const uid = cookies().get("uid")?.value;
      if (uid) {
        const decoded: { sub: string; exp: number } = jwtDecode(uid);
        return {
          user: { sub: decoded.sub },
          accessTokenExpiresAt: decoded.exp,
        };
      }
      throw new Error(`Requires authentication`);
    }

    return session;
  },
);

export const hasFreeQuota = async () => {
  const usedQuota = cookies().get("apegpt-trial")?.value || 0;
  return Number(usedQuota) < Number(process.env.APEGPT_FREE_QUOTA || 10000000);
};

function secret() {
  const s = process.env.SESSION_JWT_SECRET;
  if (!s) throw new Error("SESSION_JWT_SECRET missing");
  return new TextEncoder().encode(s);
}

export type SessionClaims = {
  sub: string; // userId
  typ: "visitor"; // or "user" later
  v: 1; // schema version for rotation
};
