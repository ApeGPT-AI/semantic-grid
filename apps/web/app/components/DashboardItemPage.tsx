"use client";

import {
  alpha,
  Box,
  CircularProgress,
  Container,
  Paper,
  Typography,
} from "@mui/material";
import { BarChart, ChartsTooltip, LineChart, PieChart } from "@mui/x-charts";
import type { GridColDef } from "@mui/x-data-grid";
import { DataGridPro as DataGrid } from "@mui/x-data-grid-pro";
import React, { useEffect, useMemo } from "react";

import HighlightedSQL from "@/app/components/SqlView";
import { useItemViewContext } from "@/app/contexts/ItemView";
import {
  buildGridColumns,
  buildPieChartSeries,
  gridDataSet,
  normalizeDataSet,
  timeKey,
} from "@/app/helpers/chart";
import { useQuery } from "@/app/hooks/useQuery";
import type { TQuery } from "@/app/lib/types";

export const DashboardItemPage = ({
  id,
  query,
  name,
  itemType,
  chartType,
}: {
  id: string;
  query?: TQuery;
  name?: string;
  itemType?: string;
  chartType?: string;
}) => {
  const {
    data,
    error: dataError,
    isLoading,
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

  const guessedChartType = useMemo(() => {
    if (chartType) return chartType;
    if (!chartType) {
      // guess based on gridColumns, i.e. if type of the first column is date, then line chart
      if (timeKey(gridColumns[0]?.type)) return "bar";
      return "pie"; // default
    }
    return null;
  }, [chartType, gridColumns]);

  const {
    view,
    setView,
    chartType: selectedChartType,
    setChartType,
  } = useItemViewContext();

  useEffect(() => {
    setChartType(guessedChartType as any);
  }, []);

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
        scaleType: selectedChartType === "bar" ? "band" : "time",
        // valueFormatter: (value: Date) => value.toLocaleDateString(),
        valueFormatter: (value: number) => new Date(value).toLocaleDateString(),
      },
    ],
    [gridColumns, selectedChartType],
  );

  const dataset = useMemo(
    () => normalizeDataSet(data?.rows || [], gridColumns),
    [data, gridColumns],
  );

  const tableDataset = useMemo(
    () => gridDataSet(data?.rows || [], gridColumns),
    [data, gridColumns],
  );

  return (
    <Container maxWidth={false}>
      {query && !isLoading && (
        <Paper
          elevation={0}
          sx={{ height: "calc(100vh - 64px)", width: "100%" }}
        >
          <Typography variant="h6" gutterBottom>
            {name}
          </Typography>
          <Typography variant="body2" gutterBottom>
            {query.summary}
          </Typography>

          <Box>
            {view === "chart" && selectedChartType === "line" && (
              <>
                <LineChart
                  yAxis={[{ width: 100 }]}
                  style={{ height: "80vh", width: "100%" }}
                  xAxis={xAxis as any} // e.g. 'col_0'
                  series={lineChartSeries}
                  dataset={dataset}
                >
                  <ChartsTooltip />
                </LineChart>
                {isLoading && (
                  <Box
                    position="absolute"
                    top={0}
                    left={0}
                    right={0}
                    bottom={0}
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    bgcolor={(theme) =>
                      alpha(theme.palette.background.default, 0.6)
                    }
                  >
                    <CircularProgress />
                  </Box>
                )}
              </>
            )}
            {view === "chart" && selectedChartType === "bar" && (
              <>
                <BarChart
                  yAxis={[{ width: 100 }]}
                  style={{ height: "80vh", width: "100%" }}
                  xAxis={xAxis as any}
                  series={lineChartSeries}
                  dataset={dataset}
                >
                  <ChartsTooltip />
                </BarChart>
                {isLoading && (
                  <Box
                    position="absolute"
                    top={0}
                    left={0}
                    right={0}
                    bottom={0}
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    bgcolor={(theme) =>
                      alpha(theme.palette.background.default, 0.6)
                    }
                  >
                    <CircularProgress />
                  </Box>
                )}
              </>
            )}
            {view === "chart" && selectedChartType === "pie" && (
              <>
                <PieChart series={pieSeries} width={200} height={200} />
                {isLoading && (
                  <Box
                    position="absolute"
                    top={0}
                    left={0}
                    right={0}
                    bottom={0}
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    bgcolor={(theme) =>
                      alpha(theme.palette.background.default, 0.6)
                    }
                  >
                    <CircularProgress />
                  </Box>
                )}
              </>
            )}
            {view === "grid" && (
              <>
                {dataError && (
                  <Box
                    sx={{
                      height: "calc(100vh - 180px)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      backgroundColor: "rgba(211, 47, 47, 0.05)",
                      border: "1px solid rgba(211, 47, 47, 0.3)",
                      borderRadius: 1,
                      p: 3,
                    }}
                  >
                    <Typography
                      variant="h6"
                      color="error"
                      gutterBottom
                      sx={{ fontWeight: 600 }}
                    >
                      Query Execution Error
                    </Typography>
                    <Typography
                      variant="body2"
                      color="error"
                      sx={{
                        fontFamily: "monospace",
                        whiteSpace: "pre-wrap",
                        textAlign: "center",
                        maxWidth: "800px",
                        mt: 1,
                      }}
                    >
                      {dataError.message ||
                        "An error occurred while executing the query"}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 2 }}
                    >
                      This may be caused by schema changes, invalid table names,
                      or query syntax errors
                    </Typography>
                  </Box>
                )}
                {!dataError && (
                  <DataGrid
                    density="compact"
                    rows={tableDataset}
                    // rowCount={rowCount}
                    columns={gridColumns}
                    loading={isLoading} // isLoading ? true : false
                    sx={{
                      height: "calc(100vh - 180px)", // Ensure table occupies full vertical space
                      border: "none", // remove outer border
                      fontSize: "1rem",
                      "& .highlight-column": {
                        backgroundColor: "rgba(255, 165, 0, 0.1)",
                      },
                      "& .MuiDataGrid-cell:focus": {
                        outline: "none",
                      },
                      "& .MuiDataGrid-cell:focus-within": {
                        outline: "none",
                      },
                      "& .MuiDataGrid-columnHeader:focus": {
                        outline: "none",
                      },
                      "& .MuiDataGrid-columnHeader:focus-within": {
                        outline: "none",
                      },
                      "& .highlight-column-header": {
                        backgroundColor: "rgba(255, 165, 0, 0.1) !important", // <- this line
                      },
                      "& .highlighted-row": {
                        backgroundColor: "rgba(255, 165, 0, 0.1)",
                      },
                    }}
                  />
                )}
              </>
            )}
            {view === "sql" && (
              <Box
                sx={{
                  "& p": {
                    fontFamily: "monospace",
                    whiteSpace: "pre-wrap",
                    color: "text.secondary",
                  },
                }}
              >
                <HighlightedSQL
                  code={query?.sql || "No SQL available for this query."}
                />
              </Box>
            )}
          </Box>
        </Paper>
      )}
    </Container>
  );
};
