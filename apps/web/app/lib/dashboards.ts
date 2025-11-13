// Legacy dashboard management (postgres + drizzle-orm)

"use server";

import { readFile } from "node:fs/promises";

import { and, eq, isNull, or } from "drizzle-orm";
import * as jose from "jose";
import type { Layout } from "react-grid-layout";

import { db } from "@/app/db";
import { dashboardItems, dashboards, queries, users } from "@/app/db/schema";

export type Dashboard = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  ownerUserId?: string;
  createdAt?: string;
  updatedAt?: string;
  items?: DashboardItem[];
  // layout?: any; // react-grid-layout layout
  maxItemsPerRow?: number;
};

export type DashboardItem = {
  id: string;
  position?: number;
  name?: string;
  description?: string;
  dashboardId: string;
  queryId: string;
  type?: "chart" | "table";
  itemType: "chart" | "table";
  chartType?: string; // e.g., 'bar', 'line', etc.
  createdAt?: string;
  updatedAt?: string;
  layout?: Layout; // react-grid-layout layout
};

export type Query = {
  id: string;
  queryUid: string; // reference to the actual query object
  description?: string;
  createdAt?: string;
  updatedAt?: string;
};

export const getDashboards = async (userId?: string) => {
  if (!userId) {
    return db.select().from(dashboards).orderBy(dashboards.createdAt);
  }
  const userDashboards = await db
    .select()
    .from(dashboards)
    .orderBy(dashboards.createdAt)
    .where(
      or(eq(dashboards.ownerUserId, userId), isNull(dashboards.ownerUserId)),
    );

  return userDashboards.map((d) => ({
    ...d,
    layout: {
      i: d.id,
      x: 0,
      y: 0,
      w: 12 / (d.maxItemsPerRow || 3),
      h: 2,
      static: true,
    },
    // slug: d.slug.startsWith("/user") ? "/user" : d.slug,
  }));
};

export const getDashboardByPath = async (path: string) => {
  // const slug = path.startsWith("/user") ? "/user" : path;
  const found = await db
    .select()
    .from(dashboards)
    .where(eq(dashboards.slug, path || "/"))
    .limit(1)
    .then((r) => r[0] || null);

  console.log("by path", path, "found", found);

  return found;
};

export const createDashboard = async (input: {
  name: string;
  slug: string;
  description?: string;
}) => {
  const [row] = await db.insert(dashboards).values(input).returning();
  return row;
};

export const getDashboardData = async (id: string) => {
  // Fetch dashboard
  const [d] = await db.select().from(dashboards).where(eq(dashboards.id, id));
  if (!d) {
    throw new Error("Dashboard not found");
  }

  // Fetch items + join with queries
  const items = await db
    .select({
      id: dashboardItems.id,
      name: dashboardItems.name,
      description: dashboardItems.description,
      itemType: dashboardItems.itemType,
      chartType: dashboardItems.chartType,
      position: dashboardItems.position,
      createdAt: dashboardItems.createdAt,
      updatedAt: dashboardItems.updatedAt,
      query: {
        id: queries.id,
        queryUid: queries.queryUid,
        description: queries.description,
        createdAt: queries.createdAt,
        updatedAt: queries.updatedAt,
      },
    })
    .from(dashboardItems)
    .innerJoin(queries, eq(queries.id, dashboardItems.queryId))
    .where(eq(dashboardItems.dashboardId, id));

  return {
    ...d,
    items: items.sort((a, b) => (a.position || 0) - (b.position || 0)),
    layout: items.map((it, idx) => ({
      i: it.id,
      x: (idx % (d.maxItemsPerRow || 3)) * (12 / (d.maxItemsPerRow || 3)),
      y: Math.floor(idx / (d.maxItemsPerRow || 3)) * 2,
      w: 12 / (d.maxItemsPerRow || 3),
      h: (12 * 3) / ((d.maxItemsPerRow || 3) * 4),
      // static: true,
    })),
  };
};

export const getDashboardItemData = async (id: string) => {
  const [row] = await db
    .select({
      id: dashboardItems.id,
      name: dashboardItems.name,
      description: dashboardItems.description,
      itemType: dashboardItems.itemType,
      chartType: dashboardItems.chartType,
      position: dashboardItems.position,
      createdAt: dashboardItems.createdAt,
      updatedAt: dashboardItems.updatedAt,
      query: {
        id: queries.id,
        queryUid: queries.queryUid,
        description: queries.description,
        createdAt: queries.createdAt,
        updatedAt: queries.updatedAt,
      },
    })
    .from(dashboardItems)
    .innerJoin(queries, eq(queries.id, dashboardItems.queryId))
    .where(eq(dashboardItems.id, id));

  if (!row) {
    throw new Error(`Dashboard item not found: ${id}`);
  }

  return row;
};

const getQuery = async ({ queryUid }: { queryUid: string }) =>
  db
    .select()
    .from(queries)
    .where(eq(queries.queryUid, queryUid as any));

export const upsertQuery = async (input: {
  queryUid: string;
  description?: string;
}) => {
  // Try to find by queryUid, else insert
  const existing = await db
    .select()
    .from(queries)
    .where(eq(queries.queryUid, input.queryUid as any));
  if (existing[0]) {
    const [upd] = await db
      .update(queries)
      .set({ description: input.description })
      .where(eq(queries.id, existing[0].id))
      .returning();
    return upd;
  }
  const [row] = await db
    .insert(queries)
    .values({ queryUid: input.queryUid as any, description: input.description })
    .returning();
  return row;
};

export const changeDefaultView = async (input: {
  itemId: string;
  itemType: "chart" | "table" | string;
  chartType?: string;
}) => {
  const [row] = await db
    .update(dashboardItems)
    .set({
      itemType: input.itemType as any,
      chartType: input.chartType,
    })
    .where(eq(dashboardItems.id, input.itemId))
    .returning();
  return row ?? null; // null if already attached
};

export const attachQueryToDashboard = async (input: {
  dashboardId: string;
  queryUid: string;
  name?: string;
  description?: string;
  itemType: "chart" | "table";
  chartType?: string;
  position?: number;
}) => {
  const q = await upsertQuery({
    queryUid: input.queryUid,
    description: input.description || "",
  });
  const [row] = await db
    .insert(dashboardItems)
    .values({
      dashboardId: input.dashboardId as any,
      queryId: q?.id as any,
      name: input.name,
      description: input.description,
      itemType: input.itemType,
      chartType: input.chartType,
      position: input.position ?? 0,
    })
    .onConflictDoNothing()
    .returning();
  return row ?? null; // null if already attached
};

export const attachQueryToUserDashboard = async (input: {
  userId: string;
  queryUid: string;
  itemType: "chart" | "table";
  chartType?: string;
  position?: number;
}) => {
  const q = await getQuery({
    queryUid: input.queryUid,
  }).then((r) => r[0] || null);
  // Find user's personal dashboard
  const [d] = await db
    .select()
    .from(dashboards)
    .where(eq(dashboards.ownerUserId, input.userId as any));
  if (!d) {
    throw new Error("User dashboard not found");
  }
  // Attach to it
  const [row] = await db
    .insert(dashboardItems)
    .values({
      dashboardId: d.id as any,
      queryId: q?.id as any,
      itemType: input.itemType,
      chartType: input.chartType,
      position: input.position ?? 0,
    })
    .onConflictDoNothing()
    .returning();
  return row ?? null; // null if already attached
};

export const detachQueryFromDashboard = async (
  dashboardId: string,
  queryUid: string,
) => {
  const q = await db
    .select()
    .from(queries)
    .where(eq(queries.queryUid, queryUid as any));
  if (!q[0]) return 0;
  const res = await db
    .delete(dashboardItems)
    .where(
      and(
        eq(dashboardItems.dashboardId, dashboardId as any),
        eq(dashboardItems.queryId, q[0].id as any),
      ),
    );
  return res.length ?? 0;
};

/** Choose how to seed a user's first dashboard */
const PRESET_SLUG_TO_FORK = "/"; // or null to create empty

// Paths provided via env (point to mounted files)
const PUB_PATH = process.env.JWT_PUBLIC_KEY!;

// simple in-memory cache for the PEMs & CryptoKeys
let pubPem: string | undefined;
let pubKey: CryptoKey | undefined;

async function getPublicKey(): Promise<CryptoKey> {
  if (pubKey) return pubKey;
  if (!pubPem) {
    try {
      pubPem = (await readFile(PUB_PATH, "utf8")).trim();
    } catch (e) {
      pubPem = process.env.JWT_PUBLIC_KEY!;
    }
  }
  // Basic sanity check to avoid the SPKI error
  if (!pubPem.includes("-----BEGIN PUBLIC KEY-----")) {
    throw new Error("Public key must be SPKI PEM (BEGIN PUBLIC KEY)");
  }
  pubKey = await jose.importSPKI(pubPem, "RS256");
  return pubKey;
}

export const ensureUserAndDashboard = async (opts: { sid?: string }) => {
  let uid: string | undefined;
  let userId: string | undefined;

  if (opts.sid) {
    // Check if this is an Auth0 user ID (starts with "auth0|" or "google-oauth2|" etc.)
    // or a guest JWT (starts with "ey" and contains dots)
    const isJwt = opts.sid.startsWith("ey") && opts.sid.includes(".");

    if (isJwt) {
      // Guest JWT - verify and extract user ID
      try {
        const publicKey = await getPublicKey();
        const jwt = await jose.jwtVerify(opts.sid, publicKey);
        console.log("Verified guest JWT", jwt);
        userId = jwt.payload?.sub;
      } catch {
        throw new Error("Invalid session");
        // no or invalid token?
      }
    } else {
      // Already a UUID (either converted Auth0 ID or guest UUID)
      userId = opts.sid;
      console.log("User UUID:", userId);
    }
  }

  const [u] = await db
    .select()
    .from(users)
    .where(eq(users.uid, userId as any));
  uid = u?.id;

  if (!uid) {
    const [u] = await db.insert(users).values({ uid: userId! }).returning();
    uid = u?.id;
    // mintedToken = await signSession({ sub: userId, typ: "visitor", v: 1 });
  }

  // 2) Ensure the user has at least one personal dashboard
  const existing = await db
    .select()
    .from(dashboards)
    .where(and(eq(dashboards.ownerUserId, uid as any)));
  let dashId: string | undefined;
  console.log("Existing dashboards for user", uid, existing);

  if (existing[0]) {
    dashId = existing[0].id;
  } else {
    // If you want to fork a preset on first run:

    // Create empty dashboard
    const [newDash] = await db
      .insert(dashboards)
      .values({
        slug: `/user/${uid}`,
        name: "User Dashboard",
        ownerUserId: uid as any,
      })
      .returning();
    dashId = newDash?.id;
  }

  return { uid, userId, dashboardId: dashId };
};
