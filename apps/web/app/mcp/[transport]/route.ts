"use server";

import { createUIResource } from "@mcp-ui/server";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod/v3";

const host = process.env.NEXT_PUBLIC_VERCEL_URL || "localhost:3000";
const baseUrl = `http${host.includes("localhost") ? "" : "s"}://${host}`;

const resource = (queryId: string, somethingElse: string) => {
  console.log("create resource", queryId, somethingElse);
  return createUIResource({
    uri: `ui://query/${queryId}`,
    content: {
      type: "externalUrl",
      iframeUrl: `${baseUrl}/q/${queryId}`,
    },
    encoding: "text",
  });
};

// app/api/[transport]/route.ts
const handler = createMcpHandler(
  (server) =>
    // @ts-ignore
    server.tool(
      "query",
      "Returns Semantic Grid query",
      {
        queryId: z.string(),
        view: z.string(), // .includes('compact').includes('expanded')
      },
      async ({ queryId, view }) => {
        console.log("MCP-UI resource", queryId, view);
        const resource = createUIResource({
          uri: `ui://query/${queryId}`,
          content: {
            type: "externalUrl",
            iframeUrl: `${baseUrl}/q/${queryId}?embed=true&view=${view}`,
          },
          encoding: "text",
        });

        return { content: [resource] };
      },
    ),
  {
    serverInfo: {
      name: "semantic-grid",
      version: "1.0.0",
    },
    // Optional server options
  },
  {
    // Optional redis config
    redisUrl: process.env.REDIS_URL!, // "127.0.0.1:6379",
    basePath: "/mcp/", // this needs to match where the [transport] is located.
    maxDuration: 60,
    verboseLogs: true,
  },
);

export { handler as GET, handler as POST };
