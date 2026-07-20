import { useState, useEffect } from "react";
import { AppBar, Toolbar, Typography, Button, Box, Chip, IconButton, Tooltip } from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import AddCommentIcon  from "@mui/icons-material/AddComment";
import LogoutIcon      from "@mui/icons-material/Logout";

const T = {
  navy:      "#0B1F3A",
  navyLight: "#162d52",
  gold:      "#C9A84C",
  goldLight: "#e8c96a",
  cream:     "#F8F4EC",
  muted:     "#6b7280",
  border:    "#D6CFC0",
  white:     "#ffffff",
  success:   "#2d7a4f",
};

export default function Navbar({ onNewChat }) {
  const navigate = useNavigate();
  const [token, setToken] = useState(localStorage.getItem("token"));

  // Keep token state in sync when localStorage changes
  // (e.g. after auto-logout from API interceptor)
  useEffect(() => {
    const sync = () => setToken(localStorage.getItem("token"));
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  // Also re-read on every render so Dashboard login/logout reflects instantly
  const currentToken = localStorage.getItem("token");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    navigate("/");
  };

  const handleNewChat = () => {
    if (onNewChat) {
      // If Dashboard passed a reset callback, use it (no reload needed)
      onNewChat();
    } else {
      // Fallback: navigate to root and let Dashboard re-mount
      navigate("/");
      window.location.reload();
    }
  };

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        bgcolor: T.navy,
        borderBottom: `1px solid ${T.navyLight}`,
        boxShadow: "0 1px 8px rgba(0,0,0,0.18)",
      }}
    >
      <Toolbar sx={{ display: "flex", justifyContent: "space-between", px: { xs: 2, sm: 3 }, minHeight: "52px !important" }}>

        {/* ── LEFT: Brand ── */}
        <Box
          display="flex" alignItems="center" gap={1.2}
          sx={{ cursor: "pointer", "&:hover": { opacity: 0.85 }, transition: "opacity 0.15s" }}
          onClick={() => navigate("/")}
        >
          <AutoStoriesIcon sx={{ color: T.gold, fontSize: 24 }} />
          <Box>
            <Typography
              variant="subtitle1"
              fontWeight={700}
              color={T.cream}
              sx={{ fontFamily: "'Georgia', serif", lineHeight: 1, letterSpacing: "-0.2px" }}
            >
              UNIJOS Library
            </Typography>
            <Typography
              variant="caption"
              color={T.gold}
              sx={{ fontSize: "0.58rem", letterSpacing: 1.8, lineHeight: 1 }}
            >
              INTELLIGENCE SYSTEM
            </Typography>
          </Box>
        </Box>

        {/* ── RIGHT: Actions ── */}
        <Box display="flex" alignItems="center" gap={1}>
          {!currentToken ? (
            <>
              <Button
                component={Link} to="/login"
                size="small"
                sx={{
                  color: T.cream, fontWeight: 500, fontSize: "0.82rem",
                  px: 1.8, borderRadius: 1.5,
                  "&:hover": { bgcolor: "rgba(255,255,255,0.08)" },
                }}
              >
                Sign In
              </Button>
              <Button
                component={Link} to="/register"
                size="small"
                variant="contained"
                sx={{
                  bgcolor: T.gold, color: T.navy, fontWeight: 700,
                  fontSize: "0.82rem", px: 2, borderRadius: 1.5,
                  "&:hover": { bgcolor: T.goldLight },
                  boxShadow: "none",
                }}
              >
                Register
              </Button>
            </>
          ) : (
            <>
              

              {/* New Chat */}
              <Tooltip title="New chat">
                <IconButton
                  onClick={handleNewChat}
                  size="small"
                  sx={{
                    color: T.cream, ml: 0.5,
                    "&:hover": { bgcolor: "rgba(255,255,255,0.08)", color: T.gold },
                    transition: "all 0.15s",
                  }}
                >
                  <AddCommentIcon sx={{ fontSize: 19 }} />
                </IconButton>
              </Tooltip>

              {/* Logout */}
              <Tooltip title="Sign out">
                <IconButton
                  onClick={handleLogout}
                  size="small"
                  sx={{
                    color: T.muted,
                    "&:hover": { bgcolor: "rgba(231,76,60,0.12)", color: "#e74c3c" },
                    transition: "all 0.15s",
                  }}
                >
                  <LogoutIcon sx={{ fontSize: 19 }} />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
