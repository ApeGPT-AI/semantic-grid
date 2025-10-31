import React from "react";

import { ensureSession } from "@/app/actions";
import GridItemNavClient from "@/app/components/GridItemNavClient";
import { ItemViewProvider } from "@/app/contexts/ItemView";
import { SessionProvider } from "@/app/contexts/SessionStatus";
import { getAllUserRequestsForSession, getUserSession } from "@/app/lib/gptAPI";
import { getDashboards } from "@/app/lib/payload";

const GridLayout = async ({
  children,
  params: { id },
}: {
  children: React.ReactElement;
  params: { id: string };
}) => {
  const { uid, dashboardId } = await ensureSession();
  const dashboards = await getDashboards(uid || undefined);
  const { metadata, ...others } = await getUserSession({ sessionId: id });
  const currentSession = await getAllUserRequestsForSession({ sessionId: id });
  const lastMessage = currentSession
    .sort((a: any, b: any) => a.sequence_number - b.sequence_number)
    .at(-1);

  return (
    <ItemViewProvider itemId={id} defaultView="grid">
      <SessionProvider initialSessionId={id}>
        <GridItemNavClient
          dashboards={dashboards}
          uid={uid || undefined}
          dashboardId={dashboardId}
          id={id}
          metadata={metadata}
          queryUid={lastMessage?.query?.query_id}
          lastMessage={lastMessage}
        />
        {/* <NavDrawer anchor="right" base="grid" /> */}
        <main>{children}</main>
      </SessionProvider>
    </ItemViewProvider>
  );
};

export default GridLayout;
