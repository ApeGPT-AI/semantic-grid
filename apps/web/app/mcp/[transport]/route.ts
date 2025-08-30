"use server";

import { createUIResource } from "@mcp-ui/server";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod/v3";

const resource = (queryId: string, somethingElse: string) => {
  console.log("create resource", queryId, somethingElse);
  return createUIResource({
    uri: `ui://query/${queryId}`,
    content: {
      type: "externalUrl",
      iframeUrl: `http://localhost:3000/q/${queryId}`,
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
            iframeUrl: `http://localhost:3000/q/${queryId}?embed=true&view=${view}`,
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
    redisUrl: "redis://127.0.0.1:6379",
    basePath: "/mcp/", // this needs to match where the [transport] is located.
    maxDuration: 60,
    verboseLogs: true,
  },
);

export { handler as GET, handler as POST };
