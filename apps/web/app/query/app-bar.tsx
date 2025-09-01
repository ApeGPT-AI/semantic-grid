"use client";

import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import type { AppBarProps, SelectChangeEvent } from "@mui/material";
import {
  Alert,
  AppBar,
  Box,
  Breadcrumbs,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  styled,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useContext, useEffect, useRef, useState } from "react";

import { createSession } from "@/app/actions";
import type { TModel } from "@/app/contexts/App";
import { AppContext, Models } from "@/app/contexts/App";
import { ThemeContext } from "@/app/contexts/Theme";
import { byTime, toChatHistoryEntry } from "@/app/helpers/nav";
import { useAppUser } from "@/app/hooks/useAppUser";
import { useUserSessions } from "@/app/hooks/useUserSessions";
import ChatSelectorIcon from "@/app/icons/chat-selector.svg";
import NewChatIcon from "@/app/icons/new-chat.svg";
import ToggleMode from "@/app/icons/toggle-mode.svg";

// import Alerts from '../alerts';

interface StyledAppBarProps extends AppBarProps {
  open?: boolean;
}

const trim = (str: string, maxLength: number = 32) => {
  if (!str) return "";
  return str.length > maxLength ? `${str.slice(0, maxLength)}...` : str;
};

export const drawerWidth = 232;
export const contextDrawerWidth = 450;

const fixedBreadcrumbs = {
  // position: "fixed", // 💡 fix to viewport top
  // top: "78px",
  width: "fit-content",
  // left: 0,
  // right: 0,
  // zIndex: 1100, // above content
  // bgcolor: "background.paper", // add background to prevent overlap
  // px: 3,
  // py: 2,
};

const floatingBreadcrumbs = { mt: 10, px: 3, mb: 1 };

const StyledAppBar = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== "open",
})<StyledAppBarProps>(({ theme }) => ({
  transition: theme.transitions.create(["margin", "width"], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  variants: [
    {
      props: ({ open }) => open,
      style: {
        width: `calc(100% - ${drawerWidth}px)`,
        marginLeft: `${drawerWidth}px`,
        transition: theme.transitions.create(["margin", "width"], {
          easing: theme.transitions.easing.easeOut,
          duration: theme.transitions.duration.enteringScreen,
        }),
      },
    },
  ],
}));

const ConstantAppBar = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== "open",
})<StyledAppBarProps>(() => ({}));

const ApplicationBar = ({ id, successors = [], ancestors = [] }: any) => {
  const router = useRouter();
  const { mode, setMode, isLarge } = useContext(ThemeContext);
  const {
    user,
    authUser,
    error,
    canContinueAsAuthUser,
    canContinueAsGuest,
    isLoading: userIsLoading,
  } = useAppUser();
  const {
    setModel,
    setNavOpen,
    setContextOpen,
    setCurrentMessage,
    setStoredModelName,
    tab,
    setTab,
  } = useContext(AppContext);
  const [bcAnchorEl, setBcAnchorEl] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const pathName = usePathname();
  const {
    data,
    error: dataError,
    mutate,
    isLoading: sessionsAreLoading,
  } = useUserSessions();

  // const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const bcOpen = Boolean(bcAnchorEl);
  const openMenu = Boolean(anchorEl);

  const gridRef = useRef<HTMLDivElement | null>(null);

  const handleOpenBc = (e: React.MouseEvent<HTMLElement>) => {
    setBcAnchorEl(e.currentTarget as any);
  };
  const handleCloseBc = (e: React.MouseEvent<HTMLElement>) => {
    setBcAnchorEl(null);
  };

  const handleOpenMenu = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget as any);
  };
  const handleCloseMenu = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(null);
  };

  const chatHistory = (data || [])
    .sort(byTime)
    .map(toChatHistoryEntry)
    .filter((s: any) => !s.tags.includes("hidden"));

  const toggleTheme = () => {
    setMode(mode === "dark" ? "light" : "dark");
    if (typeof window !== "undefined") {
      window.localStorage.setItem("theme", mode === "dark" ? "light" : "dark");
    }
  };

  const toggleTab = () => {
    setTab((t) => (t === 0 ? 1 : 0));
  };

  const handleClick = (event: any) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleDrawerOpen = () => {
    setNavOpen((o) => !o);
  };

  const handleModelChange = (event: SelectChangeEvent) => {
    setModel(
      (Models[event.target.value as string] as TModel) ||
        Object.values(Models).find((m) => m.value === event.target.value),
    );
    setStoredModelName?.(event.target.value as string);
  };

  const onSetNewCurrentChat = async () => {
    if (user?.sub) {
      // use name of last used chat
      const lastUsedName = chatHistory.sort(
        (a: any, b: any) => b.lastUpdated - a.lastUpdated,
      )?.[0]?.topic;
      // check if lastUseName ends in a number
      const lastNumber = lastUsedName?.match(/(\d+)$/);
      const newNumber = lastNumber ? parseInt(lastNumber[0]) + 1 : 1;
      try {
        const session = await createSession({
          name: `query${newNumber}`,
          tags: "test",
        });
        await mutate();
        if (session) {
          console.log("new session", session.session_id);
          router.replace(`/query/${session.session_id}`);
          // await updatePage({ sessionId: session.session_id });
          setCurrentMessage(null);
          setContextOpen(false);
          if (!isLarge) {
            setNavOpen(false);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  useEffect(() => {
    if (
      !userIsLoading &&
      !sessionsAreLoading &&
      !canContinueAsAuthUser &&
      !canContinueAsGuest
    ) {
      console.warn("No user session available, redirect to login?");
      // router.replace("/api/auth/login?returnTo=/query");
      return;
    }
    if (chatHistory && !dataError && !sessionsAreLoading && !userIsLoading) {
      const currentId = pathName.split("/query").pop();
      // const current = chatHistory.find((s: TChat) => s.uid === currentId);
      // console.log("Current", currentId);
      if (!currentId) {
        const latest = chatHistory?.[0];
        if (latest) {
          router.replace(`/query/${latest.uid}`);
        } else {
          // new chat
          console.log("new query", user);
          onSetNewCurrentChat();
        }
      }
    }
  }, [
    chatHistory,
    pathName,
    user,
    dataError,
    sessionsAreLoading,
    userIsLoading,
  ]);

  const imgSrc = () => {
    if (!isLarge) return "/apegpt-logo-mark.png";
    return mode === "dark"
      ? "/apegpt-appbar-logo-inverted.svg"
      : "/apegpt-appbar-logo.svg";
  };

  const AppBar = isLarge ? StyledAppBar : ConstantAppBar;

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        bgcolor: mode === "dark" ? "transparent" : "#E9e8e6",
        // borderBottom: (theme) =>
        // `1px solid ${alpha(theme.palette.text.disabled, 0.2)}`,
      }}
    >
      {error && (
        <Alert severity="error" variant="filled">
          {error.message}
        </Alert>
      )}
      <Toolbar variant="dense">
        <Stack
          direction="row"
          sx={{ flexGrow: 1, alignItems: "center" }}
          spacing={2}
        >
          {/* <Box
            component={Link}
            href="/query"
            sx={{ display: "flex", justifyContent: "center" }}
          >
            <img src={imgSrc()} alt="Logo" style={{ height: "40px" }} />
          </Box> */}
          <Tooltip title="Start new chat">
            <span>
              <IconButton
                // disableRipple
                // disableTouchRipple
                // disableFocusRipple
                disabled={!user}
                aria-label="new chat"
                onClick={onSetNewCurrentChat}
                edge="start"
              >
                <Box component={NewChatIcon} sx={{ color: "text.secondary" }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Open chat selector">
            <span>
              <IconButton
                // disableRipple
                // disableTouchRipple
                // disableFocusRipple
                disabled={!user}
                aria-label="open drawer"
                onClick={handleDrawerOpen}
                edge="start"
              >
                <Box
                  component={ChatSelectorIcon}
                  sx={{ color: "text.secondary" }}
                />
              </IconButton>
            </span>
          </Tooltip>
          <Breadcrumbs
            aria-label="breadcrumb"
            sx={fixedBreadcrumbs}
            separator="›"
          >
            {ancestors.map((crumb: any) => (
              <Link
                key={crumb.id}
                href={`/query/${crumb.id}`}
                passHref
                legacyBehavior
              >
                <a style={{ textDecoration: "none" }}>
                  <Typography
                    variant="body2"
                    color={crumb.id === id ? "text.primary" : "text.disabled"}
                  >
                    {trim(crumb.name, isLarge ? 32 : 20) || "New query"}
                  </Typography>
                </a>
              </Link>
            ))}
            {/* eslint-disable-next-line no-nested-ternary */}
            {successors.length === 1 ? (
              <Link
                href={`/query/${successors[0].session_id}`}
                passHref
                legacyBehavior
              >
                <a style={{ textDecoration: "none" }}>
                  <Typography
                    variant="body2"
                    color={
                      successors[0].session_id === id
                        ? "text.primary"
                        : "text.disabled"
                    }
                  >
                    {trim(successors[0].name) || "New query"}
                  </Typography>
                </a>
              </Link>
            ) : successors.length > 1 ? (
              <IconButton size="small" onClick={handleOpenBc}>
                <MoreHorizIcon fontSize="small" />
              </IconButton>
            ) : null}
          </Breadcrumbs>
          <Menu anchorEl={bcAnchorEl} open={bcOpen} onClose={handleCloseBc}>
            {successors.map((child: any) => (
              <MenuItem
                key={child.session_id}
                component={Link}
                href={`/query/${child.session_id}`}
                onClick={handleCloseBc}
                sx={{
                  textSize: "0.75rem",
                  "&:hover": {
                    color: "primary.main",
                  },
                }}
              >
                {trim(child.name) || "New query"}
              </MenuItem>
            ))}
          </Menu>
        </Stack>
        <Stack direction="row" sx={{ alignItems: "center" }} spacing={1}>
          {/* isLarge && (
            <Tooltip title="Toggle table/SQL view">
              <IconButton
                onClick={toggleTab}
                color="inherit"
                sx={{ color: "text.secondary" }}
              >
                {tab !== 1 ? <Code /> : <TableRows />}
              </IconButton>
            </Tooltip>
          ) */}
          <Tooltip title="Toggle light/dark mode">
            <IconButton onClick={toggleTheme} color="inherit">
              <Box component={ToggleMode} sx={{ color: "text.secondary" }} />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={anchorEl}
            elevation={1}
            open={openMenu}
            onClose={handleClose}
            onClick={handleClose}
            transformOrigin={{ horizontal: "right", vertical: "top" }}
            anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
            sx={{
              "& ul": {
                paddingY: "0px",
              },
              "& .MuiButtonBase-root:last-of-type": {
                borderTop: `1px solid ${"palette.grey[300]"}`,
              },
            }}
          >
            {user && authUser && <MenuItem>Profile</MenuItem>}
            {user && !authUser && <MenuItem>Guest Mode</MenuItem>}
            {user && <Divider />}
            {user && <MenuItem>{user?.email}</MenuItem>}
            {authUser && (
              <MenuItem component="a" href="/api/auth/logout">
                Logout
              </MenuItem>
            )}
            {!authUser && (
              <MenuItem component="a" href="/api/auth/login">
                Login
              </MenuItem>
            )}
          </Menu>
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

export default ApplicationBar;
