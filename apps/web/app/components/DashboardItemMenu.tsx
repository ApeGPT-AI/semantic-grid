import { MoreVert } from "@mui/icons-material";
import {
  Box,
  ClickAwayListener,
  Divider,
  IconButton,
  MenuItem,
  MenuList,
  Paper,
  Popper,
} from "@mui/material";
import { formatDistance } from "date-fns";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

import { deleteQueryFromDashboard, editDefaultItemView } from "@/app/actions";
import type { TQuery } from "@/app/lib/types";

export type TItemMenu = {
  label: string;
  key?: string;
  isSeparator?: boolean;
  destructive?: boolean;
  disabled?: boolean;
};

export const DashboardItemMenu = ({
  id,
  query,
  slugPath,
  refresh,
  fetchedAt,
  onDownloadCsvVisible,
  onDownloadCsvFull,
  onCopyUrl,
}: {
  id: string;
  query: TQuery;
  slugPath: string;
  refresh: () => void;
  fetchedAt?: number;
  onDownloadCsvVisible: () => Promise<void> | void;
  onDownloadCsvFull: () => Promise<void> | void;
  onCopyUrl: () => Promise<void> | void;
}) => {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const user = slugPath.startsWith("/user");

  const stop = (e: React.SyntheticEvent | MouseEvent) => {
    // block both bubbling and default (important for <a> / Link)
    e.stopPropagation?.();
    (e as MouseEvent).preventDefault?.();
    // in stubborn cases (Next.js Link on parent), also:
    // @ts-ignore
    // e.nativeEvent?.stopImmediatePropagation?.();
  };

  const handleButtonClick = (event: React.MouseEvent<HTMLElement>) => {
    stop(event);
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const handleCloseWithStop = (
    event: {},
    _reason: "backdropClick" | "escapeKeyDown",
  ) => {
    // MUI passes the original event here -> stop it so the parent link doesn't fire
    // @ts-ignore
    if (event?.stopPropagation) stop(event as unknown as MouseEvent);
    handleClose();
  };

  const handleMenuChoice = async (val: string, e?: React.MouseEvent) => {
    if (e) stop(e);
    const [, itemType = "table", chartType] = val.split("-");
    switch (val) {
      case "item":
        router.push(`/item/${id}#${itemType}`);
        break;
      case "view-table":
      case "view-chart-pie":
      case "view-chart-line":
        await editDefaultItemView({
          itemId: id,
          itemType: itemType as any,
          chartType,
        });
        break;
      case "edit":
      case "copy":
        router.push(`/grid?q=${query.query_id}`);
        break;
      case "delete":
        // eslint-disable-next-line no-restricted-globals,no-alert
        if (confirm(`Are you sure you want to delete item`)) {
          await deleteQueryFromDashboard({
            itemUid: id,
            queryUid: query.query_id,
          }); // , dashboardId
        }
        break;
      case "refresh":
        refresh();
        break;
      case "url":
        await onCopyUrl?.();
        break;
      case "csv":
        await onDownloadCsvVisible?.();
        break;
      default:
        break;
    }
    handleClose();
  };

  const ItemMenu = (user: boolean): TItemMenu[] =>
    user
      ? [
          { label: "Show as Table", key: "view-table" },
          { label: "Show as Pie Chart", key: "view-chart-pie" },
          { label: "Show as Line Chart", key: "view-chart-line" },
          { label: "sep1", isSeparator: true },
          { label: "Refresh", key: "refresh" },
          { label: "Refreshed", key: "refreshed", disabled: true },
          { label: "Edit with AI", key: "edit" },
          { label: "Enter Full Screen", key: "item" },
          { label: "Copy URL", key: "url" },
          { label: "Download CSV", key: "csv" },
          { label: "sep2", isSeparator: true },
          { label: "Delete", key: "delete", destructive: true },
        ]
      : [
          { label: "Refresh", key: "refresh" },
          { label: "Refreshed", key: "refreshed", disabled: true },
          { label: "Edit with AI", key: "copy" },
          { label: "Enter Full Screen", key: "item" },
          { label: "Copy URL", key: "url" },
          { label: "Download CSV", key: "csv" },
        ];

  return (
    <Box
      // belt-and-suspenders: block clicks on the wrapper too
      onClick={stop}
      onMouseDown={stop}
    >
      <IconButton
        id="dashboard-item-menu-button"
        onClick={handleButtonClick}
        onMouseDown={stop}
        size="small"
      >
        <MoreVert />
      </IconButton>

      <Popper
        // NB: this setting disallows cropping of the popper within parent
        // disablePortal
        anchorEl={anchorEl}
        open={open}
        style={{ pointerEvents: "auto", zIndex: 1300 }} // or theme.zIndex.modal
        modifiers={
          [
            // { name: "offset", options: { offset: [0, 4] } },
            // { name: "preventOverflow", options: { padding: 8 } },
            // { name: "flip", options: { fallbackPlacements: ["top-start"] } },
            // Ensure event listeners are on for scroll/resize:
            // { name: "eventListeners", enabled: true },
          ]
        }
      >
        <Paper
          onClick={(e) => stop(e)}
          onMouseDown={(e) => stop(e)}
          sx={{ minWidth: 140, bgcolor: "background.paper" }}
        >
          <ClickAwayListener onClickAway={handleClose}>
            <MenuList
              autoFocusItem={false} // 👈 avoid initial “stuck” highlight
              aria-labelledby="dashboard-item-menu-button"
              onKeyDown={(e) => {
                if (e.key === "Escape") handleClose();
              }}
            >
              {ItemMenu(user).map((mi) =>
                mi.isSeparator ? (
                  <Divider key={mi.label} />
                ) : (
                  <MenuItem
                    key={mi.label}
                    disabled={(mi as any)?.disabled}
                    onMouseDown={(e) => stop(e)}
                    onClick={(e) => handleMenuChoice(mi.key!, e)}
                    sx={{
                      minWidth: 140,
                      ...(mi.destructive && {
                        color: "error.main",
                        fontWeight: 600,
                        "&:hover": {
                          bgcolor: (t) => t.palette.error.light,
                          color: "error.main",
                        },
                        "&.Mui-focusVisible": { color: "error.main" },
                      }),
                    }}
                  >
                    {mi.label === "Refreshed"
                      ? `Last fetched: ${!fetchedAt ? "never" : formatDistance(new Date(fetchedAt || 0), new Date(), { addSuffix: true })}`
                      : mi.label}
                  </MenuItem>
                ),
              )}
            </MenuList>
          </ClickAwayListener>
        </Paper>
      </Popper>
    </Box>
  );
};
