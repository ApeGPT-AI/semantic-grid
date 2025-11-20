import "server-only";

import { getAccessToken } from "@auth0/nextjs-auth0";
import { cookies } from "next/headers";
import type { FetchResponse } from "openapi-fetch";
import createClient from "openapi-fetch";
import { cache } from "react";

import { hasFreeQuota } from "@/app/lib/authUser";
import { FreeQuotaExceededError, NonAuthorizedError } from "@/app/lib/errors";
import type { LegacyFlow, Model, TQuery } from "@/app/lib/types";
import { DB, Flow } from "@/app/lib/types";

import type { paths } from "../api/apegpt/types.gen";

const baseUrl = process.env.APEGPT_API_URL || "http://web.local";

const client = createClient<paths>({ baseUrl });

export default client;

export const createUserSession = async ({ name, tags }: any) => {
  const guestToken = cookies().get("uid")?.value;
  let token = null; //
  try {
    token = await getAccessToken();
  } catch (error: any) {
    if (!(await hasFreeQuota())) {
      throw FreeQuotaExceededError;
    }
    token = { accessToken: guestToken };
  }
  if (!token) {
    throw NonAuthorizedError;
  }
  const res = await client.POST("/api/v1/session", {
    body: { name, tags },
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });
  if (res.error) {
    console.error((res as any).error);
    return null;
    // throw new Error(JSON.stringify(res.error?.detail));
  }
  return res.data;
};

export const createLinkedUserSession = async ({
  name,
  tags,
  parentId,
  flow,
  request,
  model,
  db,
  refs,
}: any) => {
  const guestToken = cookies().get("uid")?.value;
  let token = null; //
  try {
    token = await getAccessToken();
  } catch (error: any) {
    if (!(await hasFreeQuota())) {
      throw FreeQuotaExceededError;
    }
    token = { accessToken: guestToken };
  }
  if (!token) {
    throw NonAuthorizedError;
  }
  const res = await client.POST("/api/v1/session/{session_id}/linked", {
    params: { path: { session_id: parentId } },
    body: {
      name,
      tags,
      version: flow === Flow.Interactive ? 2 : 1,
      request,
      flow,
      model,
      db,
      refs,
    },
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });
  if (res.error) {
    console.error((res as any).error);
    return null;
    // throw new Error(JSON.stringify(res.error?.detail));
  }
  return res.data;
};

export const getUserSessions = cache(async () => {
  const guestToken = cookies().get("uid")?.value;
  let token = null; //
  try {
    token = await getAccessToken();
  } catch (error: any) {
    token = { accessToken: guestToken };
  }
  if (!token) {
    throw NonAuthorizedError;
  }
  const res: FetchResponse<any, any, any> = await client.GET(
    "/api/v1/session",
    {
      headers: { Authorization: `Bearer ${token.accessToken}` },
      // cache: "no-store",
    },
  );
  if (res.error) {
    console.error((res as any).error);
    return [];
  }
  return res.data;
});

export const getUserSession = cache(
  async ({ sessionId }: { sessionId: string }) => {
    const guestToken = cookies().get("uid")?.value;
    let token = null; //
    try {
      token = await getAccessToken();
    } catch (error: any) {
      token = { accessToken: guestToken };
    }
    if (!token) {
      throw NonAuthorizedError;
    }
    const res: FetchResponse<any, any, any> = await client.GET(
      "/api/v1/session/{session_id}",
      {
        headers: { Authorization: `Bearer ${token.accessToken}` },
        params: { path: { session_id: sessionId } },
        // cache: "no-store",
      },
    );
    if (res.error) {
      console.error((res as any).error);
      return [];
    }
    return res.data;
  },
);

export const updateUserSession = async ({ sessionId, name, tags }: any) => {
  const guestToken = cookies().get("uid")?.value;
  let token = null; //
  try {
    token = await getAccessToken({ scopes: ["update:session"] });
  } catch (error: any) {
    if (!(await hasFreeQuota())) {
      throw FreeQuotaExceededError;
    }
    token = { accessToken: guestToken };
  }
  if (!token) {
    throw NonAuthorizedError;
  }
  const res = await client.PATCH(`/api/v1/session/{session_id}`, {
    params: { path: { session_id: sessionId } },
    body: { name, tags },
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });
  if (res.error) {
    console.error((res as any).error);
    return null;
    // throw new Error(JSON.stringify(res.error?.detail));
  }
  return res;
};

/*
  receives legacy flow string
  returns tuple of:
  (flow: string, model: string, db: string)
 */
const parseLegacyFlow = (flow: LegacyFlow) => {
  // eslint-disable-next-line no-nested-ternary
  const db = flow.includes("NWH")
    ? DB.NWH
    : flow.includes("V2")
      ? DB.V2
      : DB.Legacy;
  const flowType = flow.includes("Multistep") ? Flow.Multistep : Flow.Simple;
  const model = flow
    .replace(db, "")
    .replace("Multisteps", "")
    .replace(flowType, "");
  return [flowType, model, db] as [Flow, Model, DB];
};

export const createUserRequest = async ({
  sessionId,
  request,
  requestType,
  flow,
  model,
  db,
  refs,
  queryId,
}: any) => {
  // const [flow, model, db] = parseLegacyFlow(selectedFlow);
  const guestToken = cookies().get("uid")?.value;
  let token = null; //
  try {
    token = await getAccessToken({ scopes: ["create:request"] });
  } catch (error: any) {
    console.log("auth error", error.code);
    if (error.code === "ERR_INSUFFICIENT_SCOPE") {
      throw NonAuthorizedError;
    }
    if (!(await hasFreeQuota())) {
      throw FreeQuotaExceededError;
    }
    token = { accessToken: guestToken };
  }
  if (!token) {
    throw NonAuthorizedError;
  }
  if (queryId) {
    console.log("request for queryId", queryId);
    const res = await client.POST(
      "/api/v1/request/{session_id}/for_query/{query_id}",
      {
        params: { path: { session_id: sessionId, query_id: queryId } },
        body: {
          version: flow === Flow.Interactive ? 2 : 1,
          request,
          request_type: requestType,
          flow,
          model,
          db,
          refs,
        },
        headers: { Authorization: `Bearer ${token.accessToken}` },
      },
    );
    if (res.error) {
      console.error((res as any).error);
      return null;
      // throw new Error(JSON.stringify(res.error?.detail));
    }
    return res.data;
  }
  const res = await client.POST("/api/v1/request/{session_id}", {
    params: { path: { session_id: sessionId } },
    body: {
      version: flow === Flow.Interactive ? 2 : 1,
      request,
      request_type: requestType,
      flow,
      model,
      db,
      refs,
    },
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });
  if (res.error) {
    console.error((res as any).error);
    return null;
    // throw new Error(JSON.stringify(res.error?.detail));
  }
  return res.data;
};

export const createUserRequestFromQuery = async ({
  sessionId,
  queryId,
}: any) => {
  // const [flow, model, db] = parseLegacyFlow(selectedFlow);
  const guestToken = cookies().get("uid")?.value;
  let token = null; //
  try {
    token = await getAccessToken({ scopes: ["create:request"] });
  } catch (error: any) {
    console.log("auth error", error.code);
    if (error.code === "ERR_INSUFFICIENT_SCOPE") {
      throw NonAuthorizedError;
    }
    if (!(await hasFreeQuota())) {
      throw FreeQuotaExceededError;
    }
    token = { accessToken: guestToken };
  }
  if (!token) {
    throw NonAuthorizedError;
  }
  const res = await client.POST(
    "/api/v1/request/{session_id}/from_query/{query_id}",
    {
      params: { path: { session_id: sessionId, query_id: queryId } },
      headers: { Authorization: `Bearer ${token.accessToken}` },
    },
  );
  if (res.error) {
    console.error((res as any).error);
    return null;
    // throw new Error(JSON.stringify(res.error?.detail));
  }
  return res.data;
};

export const updateUserRequest = async ({ requestId, data }: any) => {
  const guestToken = cookies().get("uid")?.value;
  let token = null; //
  try {
    token = await getAccessToken({ scopes: ["update:request"] });
  } catch (error: any) {
    if (!(await hasFreeQuota())) {
      throw FreeQuotaExceededError;
    }
    token = { accessToken: guestToken };
  }
  if (!token) {
    throw NonAuthorizedError;
  }
  const res = await client.PATCH("/api/v1/request/{request_id}", {
    params: { path: { request_id: requestId } },
    body: { ...data },
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });
  if (res.error) {
    console.error((res as any).error);
    return null;
    // throw new Error(JSON.stringify(res.error?.detail));
  }
  return res.data;
};

export const getSingleUserRequest = async ({ sessionId, seqNum }: any) => {
  const guestToken = cookies().get("uid")?.value;
  let token = null; //
  try {
    token = await getAccessToken();
  } catch (error: any) {
    token = { accessToken: guestToken };
  }
  if (!token) {
    throw NonAuthorizedError;
  }
  const res = await client.GET("/api/v1/request/{session_id}/{seq_num}", {
    params: { path: { session_id: sessionId, seq_num: seqNum } },
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });
  if (res.error) {
    console.error((res as any).error);
    return null;
    // throw new Error(JSON.stringify((res as any).error?.detail));
  }
  // console.log("res", res.data);
  return res.data;
};

export const getAllUserRequestsForSession = cache(
  async ({ sessionId }: any) => {
    const guestToken = cookies().get("uid")?.value;
    let token = null; //
    try {
      token = await getAccessToken();
    } catch (error: any) {
      token = { accessToken: guestToken };
    }
    if (!token) {
      throw NonAuthorizedError;
    }
    const res = await client.GET("/api/v1/session/get_requests/{session_id}", {
      params: { path: { session_id: sessionId } },
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    if (res.error) {
      console.error((res as any).error);
      return [];
      // throw new Error(JSON.stringify((res as any).error?.detail));
    }
    return res.data;
  },
);

export const getQuery = cache(
  async ({ queryId }: any): Promise<TQuery | null> => {
    const res = await client.GET("/api/v1/query/{query_id}", {
      params: { path: { query_id: queryId } },
    });
    if (res.error) {
      console.error((res as any).error);
      return null;
    }

    return res.data as TQuery;
  },
);
