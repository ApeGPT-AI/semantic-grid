import type { GridColDef } from "@mui/x-data-grid";
import React from "react";

import { StyledValue } from "@/app/components/StyledValue";
import type { TColumn, TQuery } from "@/app/lib/types";

const signatureSubstrings = ["signature", "hash", "tx", "transaction"];
const walletSubstrings = ["wallet", "address", "account", "mint"];
const tickerSubstrings = ["symbol", "ticker"];

export const columnWidth = (name: string) => {
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

export const buildGridColumns = (query: TQuery) => {
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
      type: col.column_type,
      renderCell: (params: any) => (
        <StyledValue
          columnType={col.column_type?.replace("Nullable(", "")}
          value={params.value}
          params={params}
          successors={[]}
        />
      ),
    })) || []
  );
};

const timeKey = (t?: string) => t?.toLowerCase()?.includes("date");

export const normalizeDataSet = (rows: any[], gridColumns: GridColDef[]) =>
  // map each row element, analyzing all its elements according to gridColumns schema.
  // if necessary, map date-time strings to Date values
  rows
    .map((row: any) =>
      Object.entries(row).reduce(
        (res, [k, v], i) => ({
          ...res,
          [k.replace("col_", "")]: timeKey(gridColumns[i]?.type)
            ? new Date(v?.toString() || Date.now()) // store as epoch millis
            : v,
        }),
        {},
      ),
    )
    .map((row) =>
      // add 'id' field required by DataGrid
      ({
        id: JSON.stringify(row).slice(0, 512), // cap at 512 chars
        ...row,
      }),
    )
    .sort((a: Record<string, any>, b: Record<string, any>) => {
      // if first column is time-like, sort ascending by it
      if (gridColumns.length > 0 && timeKey(gridColumns[0]?.type)) {
        const key = gridColumns[0]?.field?.replace("col_", "") || "";
        return (a[key]?.getTime?.() || 0) - (b[key]?.getTime?.() || 0);
      }
      return 0;
    });

export const gridDataSet = (rows: any[], gridColumns: GridColDef[]) =>
  (rows || []).map((row: Record<string, any>, idx: number) => ({
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

export const buildPieChartSeries = (rows: any[], gridColumns: GridColDef[]) => {
  if (gridColumns.length < 2) return [];

  const categoryCol = gridColumns[0];
  const valueCol = gridColumns.slice(-1)[0];

  const seriesData = rows.map((row) => ({
    id: row[categoryCol?.field?.replace("col_", "") || ""],
    label: row[categoryCol?.field?.replace("col_", "") || ""],
    value: Number(row[valueCol?.field?.replace("col_", "") || ""]) || 0,
  }));

  return [
    {
      data: seriesData,
    },
  ];
};
