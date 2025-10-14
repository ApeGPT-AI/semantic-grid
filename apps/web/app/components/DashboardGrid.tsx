"use client";

import { Box, Container, Paper, Typography } from "@mui/material";
import { Responsive, WidthProvider } from "react-grid-layout";

import DashboardCard from "@/app/components/DashboardItem";
import { useLocalStorage } from "@/app/hooks/useLocalStorage";
import type { DashboardItem } from "@/app/lib/dashboards";

const ResponsiveGridLayout = WidthProvider(Responsive);

type DashboardItemMeta = {
  title: string;
  subtype?: string;
  key?: string;
  href?: string;
  queryUid?: string;
};

const byPositionAsc = (
  a: DashboardItem & DashboardItemMeta,
  b: DashboardItem & DashboardItemMeta,
) => (a.position || 0) - (b.position || 0);

const DashboardGrid = ({
  title,
  description,
  items,
  slugPath,
  maxItemsPerRow = 3,
  layout = [],
}: {
  title?: string;
  description?: string;
  items: (DashboardItem & DashboardItemMeta)[];
  slugPath: string;
  maxItemsPerRow?: number;
  layout?: any[];
}) => {
  const [savedLayout, setSavedLayout] = useLocalStorage(
    `apegpt-layout-${slugPath || "home"}`,
    JSON.stringify(layout),
  );

  const onLayoutChange = (newLayout: any) => {
    // console.log("onLayoutChange", newLayout);
    // setSavedLayout(JSON.stringify(newLayout));
  };

  return (
    <Container maxWidth={false}>
      <Paper elevation={0}>
        {description && <Typography variant="h6">{description}</Typography>}
        <Box>
          <ResponsiveGridLayout
            // style={{ minHeight: "calc(100vh - 64px)" }}
            autoSize
            className="layout"
            breakpoints={{
              xl: 1200,
              lg: 1200,
              md: 900,
              sm: 768,
              xs: 480,
              xxs: 0,
            }}
            cols={{ xl: 12, lg: 12, md: 6, sm: 3, xs: 3, xxs: 3 }}
            // rowHeight={400}
            isDraggable
            isResizable
            layouts={{
              lg: layout,
              md: [],
              sm: [],
              xs: [],
              xxs: [],
            }}
            onLayoutChange={onLayoutChange}
          >
            {items.map((it, idx) => (
              <div key={it.id}>
                <DashboardCard
                  id={it.id}
                  title={it.title}
                  // href={it.href}
                  type={it.type}
                  subtype={it.subtype}
                  queryUid={it.queryUid}
                  slugPath={slugPath}
                  maxItemsPerRow={maxItemsPerRow}
                />
              </div>
            ))}
          </ResponsiveGridLayout>
        </Box>
      </Paper>
    </Container>
  );
};

export default DashboardGrid;
