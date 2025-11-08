"use client";

import { AutoAwesome } from "@mui/icons-material";
import {
  AppBar,
  Box,
  Button,
  Container,
  IconButton,
  Toolbar,
  Tooltip,
} from "@mui/material";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useContext, useEffect } from "react";

import {
  createRequestFromQuery,
  createSession,
  createSessionWithWelcome,
} from "@/app/actions";
import { UserProfileMenu } from "@/app/components/UserProfileMenu";
import { ThemeContext } from "@/app/contexts/Theme";
import { useUserSessions } from "@/app/hooks/useUserSessions";

type Dashboard = {
  id: string;
  name: string;
  slug: string;
};

const GridNavClient = ({
  dashboards,
  uid,
  dashboardId,
}: {
  dashboards: Dashboard[];
  uid?: string;
  dashboardId?: string;
}) => {
  const router = useRouter();
  const queryParams = useSearchParams();
  const pathname = usePathname();
  const items = dashboards.filter((d) => d.slug !== "/");
  console.log("nav items", items, pathname);
  const { mode, setMode } = useContext(ThemeContext);
  const {
    error: dataError,
    mutate,
    isLoading: sessionsAreLoading,
  } = useUserSessions();

  const toggleTheme = () => {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("theme", next);
    }
  };

  const onSessionFromQuery = async (queryId: string) => {
    try {
      const session = await createSessionWithWelcome({
        name: `from query`,
        tags: "test",
      });
      await mutate();
      if (session) {
        console.log("new session from query", session.session_id);
        await createRequestFromQuery({
          sessionId: session.session_id,
          queryId,
        });
        router.replace(`/grid/${session.session_id}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const onNewSession = async () => {
    try {
      const session = await createSessionWithWelcome({
        name: `new query`,
        tags: "test",
      });
      await mutate();
      if (session) {
        router.replace(`/grid/${session.session_id}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (queryParams.get("q")) {
      console.log("Session from query", queryParams.get("q"));
      onSessionFromQuery(queryParams.get("q")!);
    } else if (pathname === "/grid") {
      console.log("No query param");
      onNewSession();
    }
  }, [queryParams]);

  const onSaveClick = () => {
    console.log("onSaveClick", dashboardId, uid);
  };

  return (
    <AppBar position="relative" color="inherit" elevation={0}>
      <Container maxWidth={false}>
        <Toolbar disableGutters sx={{ gap: 2 }}>
          <Button
            component={Link}
            href="/"
            variant="text"
            color={pathname === "/" ? "primary" : "inherit"}
            sx={{ textTransform: "none" }}
          >
            Home
          </Button>

          {items.map((d) => (
            <Button
              key={d.id}
              component={Link}
              href={d.slug}
              variant="text"
              color={pathname === d.slug ? "primary" : "inherit"}
              sx={{ textTransform: "none" }}
            >
              {d.name}
            </Button>
          ))}

          {/* Spacer between primary nav and right-side controls */}
          <Box sx={{ flexGrow: 1 }} />

          {/* <LabeledSwitch checked /> */}

          <Tooltip title="Editing With Semantic Grid AI">
            <IconButton color="primary">
              <AutoAwesome />
            </IconButton>
          </Tooltip>

          <UserProfileMenu />
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default GridNavClient;
