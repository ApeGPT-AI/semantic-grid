"use client";

import { Box, Container } from "@mui/material";
import React, { useContext, useEffect, useRef } from "react";

import { ScrollLockWrapper } from "@/app/components/ScrollLockWrapper";
import HighlightedSQL from "@/app/components/SqlView";
import { AppContext } from "@/app/contexts/App";
import { useQueryData } from "@/app/contexts/QueryData";
import { DataTable } from "@/app/q/[id]/table";

export interface IQueryContainerProps {
  query?: any; // TODO: define type
  id?: string;
  embed?: boolean;
  expanded?: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const CustomTabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pb: 3 }}>{children}</Box>}
    </Box>
  );
};

export const QueryContainer = ({
  id,
  query,
  embed,
  expanded,
}: IQueryContainerProps) => {
  const { tab } = useContext(AppContext);

  const gridRef = useRef<HTMLDivElement | null>(null);

  const { rows, isLoading, isReachingEnd, isValidating, setSize } =
    useQueryData();

  useEffect(() => {
    const handleInfiniteScroll = (event: React.UIEvent<HTMLDivElement>) => {
      const grid = gridRef.current;
      if (!grid) return;
      const scrollable = grid.querySelector(
        ".MuiDataGrid-virtualScroller",
      ) as HTMLDivElement;
      if (
        scrollable &&
        scrollable.scrollTop + scrollable.clientHeight >=
          scrollable.scrollHeight - window.innerHeight * 1.5
      ) {
        if (!isReachingEnd && !isLoading && !isValidating) {
          console.log("Nearing the bottom, loading more data...");
          setSize((s) => s + 1);
        }
      }
    };

    if (!rows || isLoading) {
      return; // No data to attach scroll listener
    }

    const grid = gridRef.current;
    const scrollable = grid?.querySelector(".MuiDataGrid-virtualScroller");
    scrollable?.addEventListener("scroll", handleInfiniteScroll as any);
    // eslint-disable-next-line consistent-return
    return () =>
      scrollable?.removeEventListener("scroll", handleInfiniteScroll as any);
  }, [gridRef, rows, isLoading]);

  return (
    <Box
      sx={{
        marginTop: "50px", // padding to avoid overlap with app bar
        height: expanded && !embed ? "calc(100vh - 50px)" : "auto",
        // overflow: "hidden",
      }}
    >
      <Box sx={{ overflow: "hidden" }}>
        <Container
          disableGutters={!expanded}
          sx={{
            position: "relative",
            width: "100%",
          }}
          maxWidth={false}
        >
          <Box>
            <CustomTabPanel value={tab} index={0}>
              <Box ref={gridRef}>
                <ScrollLockWrapper>
                  <DataTable />
                </ScrollLockWrapper>
              </Box>
            </CustomTabPanel>
            <CustomTabPanel value={tab} index={1}>
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
            </CustomTabPanel>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};
