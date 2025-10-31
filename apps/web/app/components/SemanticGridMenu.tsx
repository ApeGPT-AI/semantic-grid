import { AutoAwesome, ExpandMore } from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";

import { AppContext } from "@/app/contexts/App";
import { byTime, toUserHistoryEntry } from "@/app/helpers/nav";
import { useAppUser } from "@/app/hooks/useAppUser";
import { useUserSessions } from "@/app/hooks/useUserSessions";

export type TSemanticGridMode = "explore" | "edit" | "editing";

const tooltips = {
  explore: "Explore data with Semantic Grid AI",
  edit: "Edit query with Semantic Grid AI",
  editing: "Editing with Semantic Grid AI",
};

const colors = {
  explore: "inherit",
  edit: "inherit",
  editing: "primary",
};

export const SemanticGridMenu = ({
  mode = "explore",
  onActionClick,
  hasQuery = false,
}: {
  mode: TSemanticGridMode;
  onActionClick: () => void;
  hasQuery?: boolean;
}) => {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [popperEl, setPopperEl] = useState<null | HTMLElement>(null);
  const ref = useRef();
  const { user, authUser } = useAppUser();
  const {
    data: sessions = [],
    error: dataError,
    mutate,
    isLoading: sessionsAreLoading,
  } = useUserSessions();
  const { setNavOpen, editMode, setEditMode } = useContext(AppContext);

  const handleToggle = () => {};

  useEffect(() => {
    setPopperEl(ref?.current || null);
    if (!editMode) {
      setEditMode("/");
    }
  }, []);

  const history = useMemo(
    () =>
      sessions
        .sort(byTime)
        .map(toUserHistoryEntry)
        .filter((s: any) => !s.tags.includes("hidden") && s.message_count > 0),
    [sessions],
  );
  const openMenu = Boolean(anchorEl);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    const html = [...document.getElementsByTagName("html")][0];
    if (html) {
      html.style.overflow = "hidden";
    }
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    const html = [...document.getElementsByTagName("html")][0];
    if (html) {
      html.style.overflow = "auto";
    }
  };

  const onSaveClicked = async () => {
    if (editMode) {
      router.replace(editMode);
      setEditMode("");
    }
  };

  return (
    <>
      <Tooltip title={tooltips[mode]} ref={ref}>
        <IconButton
          color={openMenu ? "primary" : (colors[mode] as any)}
          onClick={handleMenuClick}
          aria-controls={openMenu ? "semantic-grid-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={openMenu ? "true" : undefined}
          sx={{
            "&:hover": {
              color: "primary.main",
            },
          }}
        >
          <AutoAwesome />
        </IconButton>
      </Tooltip>
      {/* mode === "editing" && (
        <Popover
          // id={id}
          open={Boolean(popperEl)}
          anchorEl={popperEl}
          onClose={() => setPopperEl(null)}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "right",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "right",
          }}
        >
          <Paper
            elevation={1}
            sx={{
              border: "1px solid #EF8626",
              backgroundColor: alpha("#EF8626", 0.1),
            }}
          >
            <Typography sx={{ p: 2 }}>
              You are now in Semantic Grid AI edit mode.
              <br /> Click the icon above to navigate options.
              <br /> When finished, save your work in your User Dashboard.
            </Typography>
          </Paper>
        </Popover>
      ) */}
      <Menu
        id="semantic-grid-menu"
        disablePortal
        anchorEl={anchorEl}
        // elevation={1}
        open={openMenu}
        onClose={handleMenuClose}
        onClick={handleMenuClose}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        sx={{
          width: 400,
          "& ul": {
            paddingY: "0px",
          },
          "& .MuiButtonBase-root:last-of-type": {
            borderTop: `1px solid ${"palette.grey[300]"}`,
          },
        }}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              overflow: "visible",
              filter: "drop-shadow(0px 2px 8px rgba(0,0,0,0.32))",
              mt: 1.5,
              "& .MuiAvatar-root": {
                width: 32,
                height: 32,
                ml: -0.5,
                mr: 1,
              },
            },
          },
        }}
      >
        {mode === "edit" && (
          <MenuItem onClick={onActionClick}>Edit Query</MenuItem>
        )}
        {mode === "explore" && (
          <MenuItem component={Link} href="/grid">
            New Query
          </MenuItem>
        )}
        {mode === "editing" && (
          <MenuItem disabled={!hasQuery} onClick={onActionClick}>
            Save Query
          </MenuItem>
        )}
        {mode === "editing" && (
          <MenuItem component={Link} href="/grid">
            New Query
          </MenuItem>
        )}
        {user && history && history.length > 0 && <Divider />}
        {user && history && history.length > 0 && (
          <MenuItem disabled>Previous Queries</MenuItem>
        )}
        {user && history && history.length > 0 && (
          <Accordion
            sx={{
              boxShadow: "none",
              "&:before": {
                display: "none",
              },
            }}
            elevation={0}
            disableGutters
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="body1">Latest 10</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {user &&
                history &&
                history.length > 0 &&
                history.slice(0, 10).map((s: any) => (
                  <MenuItem
                    key={s.uid}
                    disabled={s.current}
                    component={Link}
                    href={`/grid/${s.uid}`}
                  >
                    <Tooltip title={s.name}>
                      <Typography variant="body2" noWrap>
                        {s.name}
                      </Typography>
                    </Tooltip>
                  </MenuItem>
                ))}
            </AccordionDetails>
          </Accordion>
        )}

        {user && history && history.length > 0 && (
          <Accordion
            elevation={0}
            sx={{
              boxShadow: "none",
              "&:before": {
                display: "none",
              },
            }}
            disableGutters
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="body1">All other</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {user &&
                history &&
                history.length > 0 &&
                history.slice(10).map((s: any) => (
                  <MenuItem
                    key={s.uid}
                    disabled={s.current}
                    component={Link}
                    href={`/grid/${s.uid}`}
                  >
                    <Tooltip title={s.name}>
                      <Typography variant="body2" noWrap>
                        {s.name}
                      </Typography>
                    </Tooltip>
                  </MenuItem>
                ))}
            </AccordionDetails>
          </Accordion>
        )}
        <Divider />
        <MenuItem>About Semantic Grid AI</MenuItem>
      </Menu>
    </>
  );
};
