import { Box, CircularProgress, styled, Typography } from "@mui/material";
import type {
  GridCellParams,
  GridRenderCellParams,
  MuiEvent,
} from "@mui/x-data-grid-pro";
import {
  DataGridPro,
  GridFooter,
  GridFooterContainer,
  useGridApiContext,
  useGridApiRef,
} from "@mui/x-data-grid-pro";
import React from "react";

import { pulse } from "@/app/components/dancing-balls";
import { useChatSession } from "@/app/contexts/ChatSession";

const LoadingOverlay = () => (
  <Box
    position="absolute"
    top={0}
    left={0}
    width="100%"
    height="100%"
    bgcolor="rgba(0, 0, 0, 0.5)"
    zIndex={10}
    display="flex"
    alignItems="center"
    justifyContent="center"
  >
    <CircularProgress variant="indeterminate" />
  </Box>
);

// Custom Bottom Loading Row
const LoadingRow = () => (
  <Box sx={{ py: 2, textAlign: "left", width: "100%" }}>
    {/* <CircularProgress size={20} /> */}
    <Typography variant="body2" sx={{ mt: 0 }}>
      Loading more rows...
    </Typography>
  </Box>
);

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
    setNewCol,
  } = useChatSession();
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

  const customColumns = [
    ...gridColumns,
    {
      field: "__loading__",
      headerName: "",
      flex: 1,
      renderCell: (params: GridRenderCellParams) => {
        if (isLoading) return <LoadingRow />;
        return null;
      },
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
    },
  ];

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
      }}
      onCellClick={(
        params: GridCellParams,
        event: MuiEvent<React.MouseEvent>,
      ) => {
        const mouseEvent = event as React.MouseEvent;
        setActiveColumn(null);
        setNewCol(false);
        if (selectionModel.includes(params.row.id)) {
          setActiveRow(undefined); // Clear active row if already selected
          setSelectionModel([]); // Clear selection if the same row is clicked again
        } else if (mouseEvent.shiftKey || mouseEvent.ctrlKey) {
          setActiveRow((rr: any) => (rr ? [...rr, params.row] : [params.row]));
          setSelectionModel((rr: any) =>
            rr ? [...rr, params.row.id] : [params.row.id],
          );
        } else {
          setActiveRow([params.row]);
          setSelectionModel([params.row.id]); // Set selection to the clicked row
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
