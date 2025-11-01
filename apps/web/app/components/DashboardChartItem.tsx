"use client";

import { alpha, Box, CircularProgress } from "@mui/material";
import { BarChart, ChartsTooltip, LineChart, PieChart } from "@mui/x-charts";
import { type GridColDef } from "@mui/x-data-grid";
import React, { useMemo } from "react";

import {
  buildGridColumns,
  buildPieChartSeries,
  normalizeDataSet,
} from "@/app/helpers/chart";
import { useQuery } from "@/app/hooks/useQuery";
import { useQueryObject } from "@/app/hooks/useQueryObject";

export const DashboardChartItem = ({
  queryUid,
  chartType,
  minHeight = 300,
}: {
  queryUid: string;
  chartType: string;
  minHeight?: number;
}) => {
  const { data: query, isLoading: queryObjectIsLoading } =
    useQueryObject(queryUid);

  const {
    data,
    error: dataError,
    isLoading,
    isRefreshing,
  } = useQuery({
    id: query?.query_id,
    sql: query?.sql,
    limit: 20,
    offset: 0,
  });

  const gridColumns: GridColDef[] = useMemo(() => {
    if (!query) return [];

    const userColumns = buildGridColumns(query);

    return [...userColumns];
  }, [query]);

  const pieSeries = useMemo(
    () => buildPieChartSeries(data?.rows || [], gridColumns),
    [data, gridColumns],
  );

  const lineChartSeries = useMemo(
    () =>
      gridColumns.slice(1).map((col) => ({
        id: col.field?.replace("col_", ""),
        label: col.headerName,
        dataKey: col.field?.replace("col_", ""), // EXACTLY matches dataset key
        showMark: false,
      })),
    [gridColumns],
  );

  const xAxis = useMemo(
    () => [
      {
        dataKey: gridColumns[0]?.field?.replace("col_", ""),
        scaleType: chartType === "bar" ? "band" : "time",
        valueFormatter: (value: Date) => value.toLocaleDateString(),
        // valueFormatter: (value: number) => new Date(value).toString(),
      },
    ],
    [gridColumns],
  );

  if (chartType === "pie") {
    return (
      <>
        <PieChart
          series={pieSeries}
          width={(minHeight * 1.5) / 3}
          height={minHeight}
        />
        {(isLoading || isRefreshing) && (
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            display="flex"
            justifyContent="center"
            alignItems="center"
            bgcolor={(theme) => alpha(theme.palette.background.default, 0.6)}
          >
            <CircularProgress />
          </Box>
        )}
      </>
    );
  }
  if (chartType === "line") {
    return (
      <>
        <LineChart
          xAxis={xAxis as any} // e.g. 'col_0'
          series={lineChartSeries}
          dataset={normalizeDataSet(data?.rows || [], gridColumns)}
          width={(minHeight * 4) / 3}
          height={minHeight}
        >
          <ChartsTooltip /> {/* enables tooltips for all series at hovered X */}
        </LineChart>
        {(isLoading || isRefreshing) && (
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            display="flex"
            justifyContent="center"
            alignItems="center"
            bgcolor={(theme) => alpha(theme.palette.background.default, 0.6)}
          >
            <CircularProgress />
          </Box>
        )}
      </>
    );
  }
  if (chartType === "bar") {
    return (
      <>
        <BarChart
          xAxis={xAxis as any}
          series={lineChartSeries}
          dataset={normalizeDataSet(data?.rows || [], gridColumns)}
          width={(minHeight * 4) / 3}
          height={minHeight}
        >
          <ChartsTooltip />
        </BarChart>
        {(isLoading || isRefreshing) && (
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            display="flex"
            justifyContent="center"
            alignItems="center"
            bgcolor={(theme) => alpha(theme.palette.background.default, 0.6)}
          >
            <CircularProgress />
          </Box>
        )}
      </>
    );
  }
  return <div>Unsupported chart type: {chartType}</div>;
};
