"use client";

import { Box, Typography } from "@mui/material";
import { DataGridPro, type GridColDef } from "@mui/x-data-grid-pro";
import React, { useMemo } from "react";

import { StyledValue } from "@/app/components/StyledValue";
import { useQuery } from "@/app/hooks/useQuery";
import { useQueryObject } from "@/app/hooks/useQueryObject";
import type { TColumn, TQuery } from "@/app/lib/types";

const signatureSubstrings = ["signature", "hash", "tx", "transaction"];
const walletSubstrings = ["wallet", "address", "account", "mint"];
const tickerSubstrings = ["symbol", "ticker"];

const columnWidth = (name: string) => {
  const isWallet = walletSubstrings.some((sub) => name.includes(sub));
  const isTicker = tickerSubstrings.some((sub) => name.includes(sub));
  const isSignature = signatureSubstrings.some((sub) => name.includes(sub));
  if (isSignature) {
    return 220; // Superwide for tx-related columns
  }
  if (isWallet) {
    return 480; // Wider for wallet-related columns
  }
  if (isTicker) {
    return 180; // Wider for ticker-related columns
  }
  return 200; // Default width for other columns
};

const buildGridColumns = (query: TQuery) => {
  if (!query || !query.columns) return [];

  return (
    query.columns?.map((col: TColumn, idx: number) => ({
      field: col.id || `col_${idx}`,
      headerName: col.column_alias
        ?.replace(/_/g, " ")
        .replace(/^\w/, (c: any) => c.toUpperCase()),
      headerDescription: col.column_description,
      width: col.column_alias ? columnWidth(col.column_alias) : 200,
      sortable: false,
      renderCell: (params: any) => (
        <StyledValue
          columnName={col.column_name}
          columnType={col.column_type?.replace("Nullable(", "")}
          value={params.value}
          params={params}
          successors={[]}
        />
      ),
    })) || []
  );
};

export const DashboardTableItem = ({
  queryUid,
  minHeight,
}: {
  queryUid: string;
  minHeight: number;
}) => {
  const { data: query, isLoading: queryObjectIsLoading } =
    useQueryObject(queryUid);

  // console.log("query", query);

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

  const rows = useMemo(() => {
    if (!data?.rows || data.rows.length === 0) {
      return [];
    }
    return data.rows.map((row: Record<string, any>, idx: number) => ({
      id: idx, // Use index as ID
      ...Object.values(row)
        .slice(0)
        .reduce((acc, val, idx) => {
          const col = gridColumns[idx];
          if (col) {
            acc[col.field] = val || ""; // Map cell to column field
          }
          return acc;
        }, {}),
    }));
  }, [data, gridColumns]);

  return (
    <DataGridPro
      density="compact"
      rows={rows}
      // rowCount={rowCount}
      columns={gridColumns}
      loading={isLoading || queryObjectIsLoading} // Show spinner only during initial load, not during background refresh
      hideFooterPagination
      slots={{
        noRowsOverlay: () => (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              width: "100%",
              position: "absolute",
              top: 0,
              left: 0,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              No data available
            </Typography>
          </Box>
        ),
        noResultsOverlay: () => (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              width: "100%",
              position: "absolute",
              top: 0,
              left: 0,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              No results found
            </Typography>
          </Box>
        ),
      }}
      sx={{
        minHeight: minHeight,
        height: minHeight,
        border: "none", // remove outer border
        fontSize: "1rem",
        "& .MuiDataGrid-overlay": {
          zIndex: 1,
        },
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
  );
};
