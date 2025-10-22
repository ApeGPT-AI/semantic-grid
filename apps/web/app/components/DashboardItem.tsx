"use client";

import {
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import { saveAs } from "file-saver";
import Link from "next/link";

import { DashboardChartItem } from "@/app/components/DashboardChartItem";
import { DashboardItemMenu } from "@/app/components/DashboardItemMenu";
import { DashboardTableItem } from "@/app/components/DashboardTableItem";
import { useQuery } from "@/app/hooks/useQuery";
import { useQueryObject } from "@/app/hooks/useQueryObject";

const exportRowsAsCSV = (rows: any[]) => {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((field) => JSON.stringify(row[field] ?? "")).join(","),
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  saveAs(blob, "selected-rows.csv");
};

const DashboardCard = ({
  id,
  title,
  href,
  type,
  subtype,
  queryUid,
  slugPath,
  maxItemsPerRow,
}: {
  id: string;
  title: string;
  queryUid?: string;
  href?: string;
  type?: string;
  subtype?: string;
  slugPath: string;
  maxItemsPerRow: number;
}) => {
  // console.log("card", { id, title, href, type, subtype, queryUid });
  const { data: query } = useQueryObject(queryUid!);
  // console.log("card query data", data);
  const minHeight = maxItemsPerRow ? 400 * (3 / maxItemsPerRow) : 400;
  const { refresh, fetchedAt, data } = useQuery({
    id: queryUid,
    sql: query?.sql,
    limit: 20,
    offset: 0,
  });

  const onCopyUrl = async () => {
    if (!queryUid) return;
    const url = `${window.location.origin}/q/${queryUid}`;
    await navigator.clipboard.writeText(url);
  };

  const onDownloadCsvVisible = async () => {
    if (!queryUid || !data) return;
    exportRowsAsCSV(data?.rows);
  };

  const inner = (
    <Card
      elevation={0}
      sx={
        {
          // minHeight: 400,
          // minWidth: 400,
          // width: 400,
        }
      }
    >
      <CardActionArea component={href ? Link : "div"} href={href} sx={{ p: 2 }}>
        <CardContent>
          <Stack spacing={1} justifyContent="center">
            {type !== "create" && (
              <Stack
                direction="row"
                alignItems="top"
                justifyContent="space-between"
              >
                <Typography variant="body1" color="text.primary" gutterBottom>
                  {title || query?.summary}
                </Typography>
                {query && (
                  <DashboardItemMenu
                    id={id}
                    query={query}
                    slugPath={slugPath}
                    refresh={refresh}
                    fetchedAt={fetchedAt || undefined}
                    onDownloadCsvFull={async () => {}}
                    onDownloadCsvVisible={onDownloadCsvVisible}
                    onCopyUrl={onCopyUrl}
                  />
                )}
              </Stack>
            )}
            {type === "create" && (
              <Stack
                direction="column"
                alignItems="center"
                justifyContent="center"
                spacing={2}
                sx={{ flexGrow: 1, opacity: 0.5, height: minHeight }}
              >
                <Typography
                  variant="h1"
                  component="div"
                  sx={{ fontSize: 64, lineHeight: 1 }}
                >
                  +
                </Typography>
                <Typography variant="body1">Add New</Typography>
              </Stack>
            )}
            {type === "chart" && queryUid && (
              <DashboardChartItem
                queryUid={queryUid}
                chartType={subtype || "pie"}
                minHeight={minHeight}
              />
            )}
            {type === "table" && queryUid && (
              <DashboardTableItem queryUid={queryUid} minHeight={minHeight} />
            )}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );

  return inner;
};

export default DashboardCard;
