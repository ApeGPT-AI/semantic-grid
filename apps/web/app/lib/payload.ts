"use server";

import { readFile } from "node:fs/promises";

import * as jose from "jose";
import { stringify } from "qs-esm";

import type { Dashboard, DashboardItem } from "@/app/lib/payload-types";

export const getFromPayloadById = async (collection: string, id: string) => {
  const url = new URL(`/api/${collection}/${id}`, process.env.PAYLOAD_API_URL);
  const res = await fetch(url.toString(), {
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.PAYLOAD_API_KEY,
    } as any,
  });
  if (!res.ok) {
    throw new Error(
      `Error fetching from Payload: ${res.status} ${res.statusText} url: ${url.toString()}`,
    );
  }
  return res.json();
};

export const getFromPayload = async (collection: string, query?: string) => {
  const url = new URL(
    `/api/${collection}${query || ""}`,
    process.env.PAYLOAD_API_URL,
  );
  const res = await fetch(url.toString(), {
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.PAYLOAD_API_KEY,
    } as any,
  });
  if (!res.ok) {
    throw new Error(
      `Error fetching from Payload: ${res.status} ${res.statusText} url: ${url.toString()}`,
    );
  }
  return res.json();
};

export const postToPayload = async (collection: string, data: any) => {
  const url = new URL(`/api/${collection}`, process.env.PAYLOAD_API_URL);
  const res = await fetch(url.toString(), {
    method: "POST",
    body: JSON.stringify(data),
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.PAYLOAD_API_KEY,
    } as any,
  });
  if (!res.ok) {
    throw new Error(
      `Error posting to Payload: ${res.status} ${res.statusText}`,
    );
  }
  return res.json();
};

export const patchOnPayload = async (
  collection: string,
  id: number,
  data: any,
) => {
  const url = new URL(
    `/api/${collection}/${id.toString()}`,
    process.env.PAYLOAD_API_URL,
  );
  const res = await fetch(url.toString(), {
    method: "PATCH",
    body: JSON.stringify(data),
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.PAYLOAD_API_KEY,
    } as any,
  });
  if (!res.ok) {
    throw new Error(
      `Error posting to Payload: ${res.status} ${res.statusText}`,
    );
  }
  return res.json();
};

export const getDashboards = async (userId?: string) => {
  if (!userId) {
    const where = { ownerUserId: { exists: false } };
    const query = stringify(
      {
        where,
        limit: 1000,
        sort: "createdAt",
      },
      { addQueryPrefix: true },
    );
    const dashboards = await getFromPayload("dashboards", query).then(
      (r) => r?.docs || [],
    );
    return dashboards.map((d: Dashboard) => ({
      ...d,
      // slug: d.slug.startsWith("/user") ? "/user" : d.slug,
    }));
  }

  const where = {
    or: [
      { ownerUserId: { equals: userId } },
      { ownerUserId: { exists: false } },
    ],
  };
  const query = stringify(
    {
      where,
      limit: 1000,
      sort: "createdAt",
    },
    { addQueryPrefix: true },
  );
  const userDashboards = await getFromPayload("dashboards", query).then(
    (r) => r?.docs || [],
  );
  const mappedDashboards = userDashboards.map((d: Dashboard) => ({
    ...d,
    // slug: d.slug.startsWith("/user") ? "/user" : d.slug,
  }));
  return [
    mappedDashboards.find((d: Dashboard) => d.slug === "/"),
    ...mappedDashboards.filter(
      (d: Dashboard) => d.slug !== "/" && d.ownerUserId !== userId,
    ),
    mappedDashboards.find((d: Dashboard) => d.ownerUserId === userId),
  ];
};

export const getDashboardByPath = async (path: string) => {
  // const slug = path.startsWith("/user") ? "/user" : path;
  const where = { slug: { equals: path || "/" } };
  const query = stringify(
    {
      where,
      limit: 1,
    },
    { addQueryPrefix: true },
  );
  const [found] = await getFromPayload("dashboards", query).then(
    (r) => r?.docs || [],
  );
  return found || null;
};

export const getDashboardData = async (id: string) => {
  // Fetch dashboard
  const dashboard = await getFromPayloadById("dashboards", id);
  if (!dashboard) {
    return null;
    // throw new Error(`Dashboard not found: ${id}`);
  }

  const maxItems = dashboard.maxItemsPerRow || 2;
  const layout = dashboard.items?.map((it: DashboardItem, idx: number) => ({
    i: it.id.toString(),
    x: (idx % maxItems) * (12 / maxItems),
    y: Math.floor(idx / maxItems),
    w: it.width || 12 / maxItems,
    h: it.height || (it.width ? (it.width * 3) / 5 : (12 * 3) / (maxItems * 4)),
    // static: true,
  }));

  return {
    ...dashboard,
    layout,
  };
};

export const getDashboardItemData = async (id: string) => {
  const where = { id: { equals: id } };
  const query = stringify(
    {
      where,
      limit: 1,
    },
    { addQueryPrefix: true },
  );
  const [row] = await getFromPayload("dashboard_items", query).then(
    (r) => r?.docs || [],
  );

  if (!row) {
    return null;
    // throw new Error(`Dashboard item not found: ${id}`);
  }

  return row;
};

const getQuery = async ({ queryUid }: { queryUid: string }) => {
  const where = { queryUid: { equals: queryUid } };
  const query = stringify(
    {
      where,
      limit: 1,
    },
    { addQueryPrefix: true },
  );
  const [row] = await getFromPayload("queries", query).then(
    (r) => r?.docs || [],
  );
  return row || null;
};

export const upsertQuery = async (input: {
  queryUid: string;
  description?: string;
}) => {
  const where = { queryUid: { equals: input.queryUid } };
  const query = stringify(
    {
      where,
      limit: 1,
    },
    { addQueryPrefix: true },
  );
  // Try to find by queryUid, else insert
  const existing = await getFromPayload("queries", query).then(
    (r) => r?.docs || [],
  );

  if (existing[0]) {
    return patchOnPayload("queries", existing[0].id, {
      description: input.description || existing[0].description,
    }).then((r) => r);
  }
  return postToPayload("queries", {
    queryUid: input.queryUid,
    description: input.description || "",
  }).then((r) => r);
};

export const changeDefaultView = async (input: {
  itemId: string;
  itemType: "chart" | "table" | string;
  chartType?: string;
}) =>
  patchOnPayload("dashboard_items", parseInt(input.itemId, 10), {
    type: input.itemType as any,
    itemType: input.itemType as any,
    chartType: input.chartType,
  }).then((r) => r);

export const attachQueryToDashboard = async (input: {
  dashboardId: string;
  queryUid: string;
  name?: string;
  description?: string;
  itemType: "chart" | "table";
  chartType?: string;
  width?: number;
}) => {
  const q = await upsertQuery({
    queryUid: input.queryUid,
    description: input.description || "",
  });

  if (q?.doc?.id) {
    const item = await postToPayload("dashboard_items", {
      query: q.doc.id,
      name: input.name || q.doc.name,
      description: input.description || q.doc.description,
      type: input.itemType,
      itemType: input.itemType,
      chartType: input.chartType,
      width: input.width || 4,
    }).then((r) => r.doc);

    if (item?.id) {
      const dashboard = await getFromPayloadById(
        "dashboards",
        input.dashboardId,
      ).then((r) => r || null);
      if (!dashboard) {
        throw new Error(`Dashboard not found: ${input.dashboardId}`);
      }
      await patchOnPayload("dashboards", parseInt(input.dashboardId, 10), {
        items: [...(dashboard.items || []), item.id],
      }).then((r) => r);
    }
  }
};

export const attachQueryToUserDashboard = async (input: {
  userId: string;
  queryUid: string;
  itemType: "chart" | "table";
  chartType?: string;
  position?: number;
}) => {
  if (!input.userId) {
    throw new Error("No userId provided");
  }

  const where = { ownerUserId: { equals: input.userId } };
  const query = stringify(
    {
      where,
      limit: 1,
    },
    { addQueryPrefix: true },
  );
  const userDashboards = await getFromPayload("dashboards", query).then(
    (r) => r?.docs || [],
  );
  if (!userDashboards[0]) {
    throw new Error("User dashboard not found");
  }
  const dashboardId = userDashboards[0].id;

  return attachQueryToDashboard({
    name: "New Item",
    dashboardId: dashboardId.toString(),
    queryUid: input.queryUid,
    itemType: input.itemType,
    chartType: input.chartType,
  });
};

export const detachQueryFromDashboard = async (
  dashboardId: string,
  _queryUid: string,
  itemUid: string,
) => {
  const dashboard = await getFromPayloadById("dashboards", dashboardId);
  if (!dashboard) {
    console.log("No dashboard found", dashboardId);
    return 0;
  }
  // Remove item from dashboard's items array
  return patchOnPayload("dashboards", parseInt(dashboardId, 10), {
    items: (dashboard?.items || [])
      .map((item: DashboardItem) => item.id)
      .filter((id: number) => id !== parseInt(itemUid)),
  }).then((r) => r);
};

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
  console.log("ensureUserAndDashboard:", opts);

  if (opts.sid) {
    try {
      const publicKey = await getPublicKey();
      const jwt = await jose.jwtVerify(opts.sid, publicKey);
      // console.log("Verified guest JWT", jwt);
      userId = jwt.payload?.sub;
      uid = jwt.payload.sub;
      console.log("uid", uid);
    } catch {
      throw new Error("Invalid session");
      // no or invalid token?
    }
  }

  if (!userId) {
    // No user ID, return no-op
    return { uid: null, userId: null, dashboardId: null };
  }

  const whereDash = { ownerUserId: { equals: userId || null } };
  const queryDash = stringify(
    {
      where: whereDash,
      limit: 1,
    },
    { addQueryPrefix: true },
  );
  const [dash] = await getFromPayload("dashboards", queryDash).then(
    (r) => r?.docs || [],
  );
  const dashId = dash?.id;

  if (!dashId) {
    // Create empty dashboard
    const userDashboard = {
      id: null as unknown,
      name: "User Dashboard",
      slug: `/user/${userId}`,
      ownerUserId: userId,
      description: "Personal dashboard",
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Dashboard;
    const res = await postToPayload("dashboards", userDashboard);
    console.log("Created user dashboard", res);
  }

  return { uid, userId, dashboardId: dashId };
};
