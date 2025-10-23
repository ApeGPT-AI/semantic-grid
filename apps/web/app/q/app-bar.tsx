"use client";

import { Code, TableRows } from "@mui/icons-material";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import type { AppBarProps } from "@mui/material";
import {
  Alert,
  AppBar,
  Box,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  styled,
  Toolbar,
  Tooltip,
} from "@mui/material";
import { useRouter } from "next/navigation";
import React, { useContext, useState } from "react";

import {
  addQueryToUserDashboard,
  createRequestFromQuery,
  createSession,
} from "@/app/actions";
import { AppContext } from "@/app/contexts/App";
import { ThemeContext } from "@/app/contexts/Theme";
import { useAppUser } from "@/app/hooks/useAppUser";
import { useUserSessions } from "@/app/hooks/useUserSessions";
import NewChatIcon from "@/app/icons/new-chat.svg";
import ShareQuery from "@/app/icons/share.svg";
import ToggleMode from "@/app/icons/toggle-mode.svg";

interface StyledAppBarProps extends AppBarProps {
  open?: boolean;
}

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
        width: `calc(100%)`,
        // marginLeft: `${drawerWidth}px`,
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

const ApplicationBar = ({ id }: any) => {
  const router = useRouter();
  const { mode, setMode, isLarge } = useContext(ThemeContext);
  const { user, authUser, error } = useAppUser();
  console.log("app bar user", user);
  const { setNavOpen, tab, setTab } = useContext(AppContext);
  const {
    error: dataError,
    mutate,
    isLoading: sessionsAreLoading,
  } = useUserSessions();

  const [anchorEl, setAnchorEl] = useState(null);
  const openMenu = Boolean(anchorEl);

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

  const onShareClick = () => {
    if (typeof window !== "undefined") {
      // Use the Share API if available
      if (navigator.share) {
        navigator
          .share({
            url: `${window.location.origin}/q/${id}`,
          })
          .catch((error) => {
            console.error("Error sharing:", error);
          });
      }
    }
  };

  const onNewChat = async () => {
    if (user?.sub) {
      try {
        const session = await createSession({
          name: `from query`,
          tags: "test",
        });
        await mutate();
        if (session) {
          console.log("new session from query", session.session_id);
          await createRequestFromQuery({
            sessionId: session.session_id,
            queryId: id,
          });
          router.replace(`/grid/${session.session_id}`);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const onAddToUserDashboard = async () => {
    const userDashboardId = await addQueryToUserDashboard({
      queryUid: id,
      itemType: "table",
    });
    router.push(`${userDashboardId}`);
  };

  const AppBar = isLarge ? StyledAppBar : ConstantAppBar;

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
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
                edge="start"
                onClick={onNewChat}
              >
                <Box component={NewChatIcon} sx={{ color: "text.secondary" }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Add to User Dashboard">
            <span>
              <IconButton
                // disableRipple
                // disableTouchRipple
                // disableFocusRipple
                // disabled={!user}
                aria-label="add to user dashboard"
                edge="start"
                onClick={onAddToUserDashboard}
              >
                <Box
                  component={PlaylistAddIcon}
                  sx={{ color: "text.secondary" }}
                />
              </IconButton>
            </span>
          </Tooltip>
          {/* <Tooltip title="Open chat selector">
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
          </Tooltip> */}
        </Stack>
        <Stack direction="row" sx={{ alignItems: "center" }} spacing={1}>
          {typeof navigator !== "undefined" && Boolean(navigator.share) && (
            <Tooltip title="Share this query">
              <IconButton
                // disableRipple
                // disableTouchRipple
                // disableFocusRipple
                onClick={onShareClick}
                color="inherit"
                sx={{ color: "text.secondary" }}
              >
                <Box component={ShareQuery} sx={{ color: "text.secondary" }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Toggle table/SQL view">
            <IconButton
              // disableRipple
              // disableTouchRipple
              // disableFocusRipple
              onClick={toggleTab}
              color="inherit"
              sx={{ color: "text.secondary" }}
            >
              {tab === 0 ? <Code /> : <TableRows />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Toggle light/dark mode">
            <IconButton
              // disableRipple
              // disableTouchRipple
              // disableFocusRipple
              onClick={toggleTheme}
              color="inherit"
            >
              <Box component={ToggleMode} sx={{ color: "text.secondary" }} />
            </IconButton>
          </Tooltip>
          {/* <IconButton
            disableRipple
            disableTouchRipple
            disableFocusRipple
            onClick={handleClick}
          >
            {user ? (
              <Avatar sx={{ width: 26, height: 26 }} src={user.picture || ""} />
            ) : (
              <AccountCircle />
            )}
          </IconButton> */}
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
