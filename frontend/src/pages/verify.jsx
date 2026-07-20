// src/pages/verify.jsx
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Box, Button, Typography, CircularProgress } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon       from "@mui/icons-material/Error";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import API from "../api/authApi";
import { T } from "../components/AuthLayout";

export default function Verify() {
  const { token } = useParams();
  const navigate  = useNavigate();
  const ranRef    = useRef(false);

  const [state, setState] = useState("loading"); // "loading" | "success" | "error"
  const [status, setStatus] = useState("Verifying your account…");

  useEffect(() => {
    if (!token) {
      setState("error");
      setStatus("Invalid or missing verification link.");
      return;
    }

    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        const res = await API.get(`/auth/verify/${token}`);
        setStatus(res.data.message || "Account verified successfully!");
        setState("success");
        setTimeout(() => navigate("/login"), 3000);
      } catch (err) {
        setStatus(err.response?.data?.message || "Invalid or expired verification link.");
        setState("error");
      }
    })();
  }, [token, navigate]);

  return (
    <Box sx={{
      minHeight: "100vh",
      bgcolor: T.navy,
      backgroundImage: `radial-gradient(ellipse at 70% 10%, ${T.navyLight} 0%, ${T.navy} 65%)`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      px: 2, py: 4,
    }}>
      {/* Brand */}
      <Box display="flex" alignItems="center" gap={1.2} mb={3}
        sx={{ cursor: "pointer", "&:hover": { opacity: 0.85 } }}
        onClick={() => navigate("/")}>
        <AutoStoriesIcon sx={{ color: T.gold, fontSize: 28 }} />
        <Box>
          <Typography variant="subtitle1" fontWeight={700} color={T.cream}
            sx={{ fontFamily: "'Georgia', serif", lineHeight: 1 }}>
            UNIJOS Library
          </Typography>
          <Typography variant="caption" color={T.gold}
            sx={{ fontSize: "0.58rem", letterSpacing: 1.8 }}>
            INTELLIGENCE SYSTEM
          </Typography>
        </Box>
      </Box>

      {/* Card */}
      <Box sx={{
        width: "100%", maxWidth: 420,
        bgcolor: T.white,
        borderRadius: 3,
        boxShadow: "0 24px 64px rgba(0,0,0,0.28)",
        overflow: "hidden",
        textAlign: "center",
      }}>
        {/* Top strip — gold on success, red on error, navy while loading */}
        <Box sx={{
          height: 4,
          bgcolor: state === "success" ? T.gold : state === "error" ? "#c0392b" : T.navy,
          transition: "background-color 0.4s",
        }} />

        <Box sx={{ p: { xs: 4, sm: 5 } }}>
          {/* Icon */}
          <Box sx={{ mb: 2.5, display: "flex", justifyContent: "center" }}>
            {state === "loading" && (
              <CircularProgress size={60} thickness={3} sx={{ color: T.gold }} />
            )}
            {state === "success" && (
              <CheckCircleIcon sx={{ fontSize: 64, color: T.gold }} />
            )}
            {state === "error" && (
              <ErrorIcon sx={{ fontSize: 64, color: "#c0392b" }} />
            )}
          </Box>

          <Typography variant="h5" fontWeight={700} color={T.navy}
            sx={{ fontFamily: "'Georgia', serif", mb: 1 }}>
            {state === "loading" && "Verifying…"}
            {state === "success" && "Verified!"}
            {state === "error"   && "Verification failed"}
          </Typography>

          <Typography variant="body2" sx={{
            color: state === "success" ? T.success : state === "error" ? "#c0392b" : T.muted,
            lineHeight: 1.7, mb: 3,
          }}>
            {status}
          </Typography>

          {/* Success actions */}
          {state === "success" && (
            <>
              <Typography variant="caption" color={T.muted} display="block" mb={2.5}>
                Redirecting you to sign in automatically…
              </Typography>
              <Button fullWidth variant="contained" onClick={() => navigate("/login")}
                sx={{
                  bgcolor: T.navy, color: T.cream, fontFamily: "'Georgia', serif",
                  fontWeight: 700, borderRadius: 2, textTransform: "none", py: 1.3,
                  "&:hover": { bgcolor: T.navyLight },
                }}>
                Go to Sign In
              </Button>
            </>
          )}

          {/* Error actions */}
          {state === "error" && (
            <Box display="flex" flexDirection="column" gap={1.5}>
              <Button fullWidth variant="contained" onClick={() => navigate("/register")}
                sx={{
                  bgcolor: T.navy, color: T.cream, fontFamily: "'Georgia', serif",
                  fontWeight: 700, borderRadius: 2, textTransform: "none", py: 1.3,
                  "&:hover": { bgcolor: T.navyLight },
                }}>
                Register again
              </Button>
              <Link to="/login" style={{ textDecoration: "none" }}>
                <Typography sx={{ color: T.gold, fontWeight: 600, fontSize: "0.83rem" }}>
                  ← Back to Sign In
                </Typography>
              </Link>
            </Box>
          )}
        </Box>
      </Box>

      <Typography variant="caption" color={T.muted} sx={{ mt: 3, fontSize: "0.68rem" }}>
        University of Jos · Library Intelligence System
      </Typography>
    </Box>
  );
}
