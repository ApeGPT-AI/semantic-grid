import { Box, styled, Typography } from "@mui/material";
import type { GridCellParams, MuiEvent } from "@mui/x-data-grid-pro";
import {
  DataGridPro,
  GridFooter,
  GridFooterContainer,
  useGridApiContext,
  useGridApiRef,
} from "@mui/x-data-grid-pro";
import React from "react";

import { pulse } from "@/app/components/dancing-balls";
import { useQueryData } from "@/app/contexts/QueryData";

const PulsingMonoText = styled(Typography)(({ theme }) => ({
  // color: theme.palette.grey[500],
  fontFamily: theme.typography.caption.fontFamily,
  animation: `${pulse} 1.5s ease-in-out infinite`,
}));

const CustomFooter = ({ isFetchingMore }: { isFetchingMore: boolean }) => {
  const apiRef = useGridApiContext();

  return (
    <GridFooterContainer
      sx={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      {/* Append loading indicator if needed */}
      <Box>
        {isFetchingMore && <PulsingMonoText>Loading more...</PulsingMonoText>}
      </Box>
      {/* @ts-ignore */}
      <GridFooter apiRef={apiRef} sx={{ width: "50%" }} />
    </GridFooterContainer>
  );
};

function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (Array.isArray(obj)) return obj.map(deepClone) as any;

  const cloned: any = {};
  for (const key in obj) {
    const value = (obj as any)[key];
    cloned[key] = typeof value === "function" ? value : deepClone(value);
  }
  return cloned;
}

export const DataTable = () => {
  const {
    rows,
    gridColumns,
    activeColumn,
    activeRows,
    setActiveColumn,
    setActiveRows: setActiveRow,
    sortModel,
    setSortModel,
    paginationModel,
    setPaginationModel,
    rowCount,
    isLoading,
    isValidating,
    selectionModel,
    setSelectionModel,
  } = useQueryData();

  const apiRef = useGridApiRef();
  // console.log("DataTable loading:", isLoading, "validating:", isValidating);

  // eslint-disable-next-line react/no-unstable-nested-components
  const CustomNoRowsOverlay = () => (
    <Box
      sx={{
        display: "flex",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 18,
      }}
    >
      <Typography variant="body2" color="textSecondary">
        No data or no query
      </Typography>
    </Box>
  );

  return (
    <DataGridPro
      apiRef={apiRef}
      density="compact"
      sortingMode="server"
      paginationMode="server"
      sortModel={sortModel}
      disableMultipleRowSelection={false} // default is false
      onSortModelChange={(newModel) => setSortModel(newModel)}
      paginationModel={paginationModel}
      onPaginationModelChange={(newModel) => setPaginationModel(newModel)}
      disableRowSelectionOnClick
      rowSelectionModel={selectionModel}
      onRowSelectionModelChange={(newSelection) => {
        // const last = Array.isArray(newSelection) ? newSelection.slice(-1) : [];
        // setSelectionModel(last as number[]); // Keep only the last selected row
        // console.log("Row selection:", newSelection);
        setSelectionModel(newSelection as number[]); // Update selection model with new selection
        setActiveColumn(null); // Clear active column on row selection
      }}
      rows={rows}
      rowCount={rowCount}
      columns={gridColumns}
      loading={isLoading} // isLoading ? true : false
      onColumnHeaderClick={(params) => {
        if (activeColumn?.field !== "__add_column__") {
          // setNewCol(false);
        }
        if (activeColumn && activeColumn.field === params.colDef.field) {
          setActiveColumn(null);
        } else {
          setActiveColumn(params.colDef);
        }
        setSelectionModel([]); // ⬅️ Clears all selected rows
        setActiveRow(undefined); // Clear active row on column header click
        window.parent.postMessage(
          {
            type: "tool",
            payload: {
              toolName: "uiInteraction",
              params: { action: "button-click", from: "remote-dom" },
              meta: {
                action: "table.select.column",
                column: JSON.stringify(params.colDef),
              },
            },
          },
          "*",
        );
      }}
      onCellClick={(
        params: GridCellParams,
        event: MuiEvent<React.MouseEvent>,
      ) => {
        const mouseEvent = event as React.MouseEvent;
        setActiveColumn(null);
        if (selectionModel.includes(params.row.id)) {
          setActiveRow(undefined); // Clear active row if already selected
          setSelectionModel([]); // Clear selection if the same row is clicked again
          window.parent.postMessage(
            {
              type: "tool",
              payload: {
                toolName: "uiInteraction",
                params: { action: "button-click", from: "remote-dom" },
                meta: {
                  action: "table.select.row",
                  row: undefined,
                },
              },
            },
            "*",
          );
        } else if (mouseEvent.shiftKey || mouseEvent.ctrlKey) {
          setActiveRow((rr: any) => (rr ? [...rr, params.row] : [params.row]));
          setSelectionModel((rr: any) =>
            rr ? [...rr, params.row.id] : [params.row.id],
          );
          window.parent.postMessage(
            {
              type: "tool",
              payload: {
                toolName: "uiInteraction",
                params: { action: "button-click", from: "remote-dom" },
                meta: {
                  action: "table.select.row",
                  row: activeRows ? [...activeRows, params.row] : [params.row],
                },
              },
            },
            "*",
          );
        } else {
          setActiveRow([params.row]);
          setSelectionModel([params.row.id]); // Set selection to the clicked row
          window.parent.postMessage(
            {
              type: "tool",
              payload: {
                toolName: "uiInteraction",
                params: { action: "button-click", from: "remote-dom" },
                meta: {
                  action: "table.select.row",
                  row: [params.row],
                },
              },
            },
            "*",
          );
        }
      }}
      getRowClassName={(params) => {
        // if (!activeRows || activeRows.length === 0) return "";
        if (
          activeRows?.filter(Boolean).find((r: any) => r?.id === params.row?.id)
        ) {
          return "highlighted-row";
        }
        return "";
      }}
      getCellClassName={(params) => {
        if (
          params.colDef.type === "checkboxSelection" || // default MUI checkbox column
          params.colDef.field === "__check__" // just in case
        ) {
          return "";
        }
        return activeColumn?.field === params.field ? "highlight-column" : "";
      }}
      slots={{
        // eslint-disable-next-line react/no-unstable-nested-components,react/jsx-no-useless-fragment
        noRowsOverlay: isLoading ? () => <></> : CustomNoRowsOverlay,
        // eslint-disable-next-line react/no-unstable-nested-components
        footer: () => (
          <CustomFooter isFetchingMore={isValidating && !isLoading} />
        ),
      }}
      sx={{
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
  );
};
