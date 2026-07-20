// src/pages/forgotPassword.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  TextField, Button, Box, Alert, CircularProgress,
  Typography, Dialog, DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import API from "../api/authApi";
import AuthLayout, { T, fieldSx, btnSx } from "../components/AuthLayout";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [open,    setOpen]    = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await API.post("/auth/forgot-password", { email });
      setOpen(true);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we'll send you a secure reset link"
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2, fontSize: "0.83rem" }}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap={2}>
        <TextField
          fullWidth label="Email address" type="email"
          value={email} onChange={e => setEmail(e.target.value)}
          required sx={fieldSx}
        />

        <Button type="submit" fullWidth variant="contained"
          disabled={loading || !email} sx={btnSx}>
          {loading
            ? <><CircularProgress size={18} sx={{ mr: 1, color: T.cream }} /> Sending…</>
            : "Send Reset Link"
          }
        </Button>
      </Box>

      <Box textAlign="center" mt={3}>
        <Link to="/login" style={{ textDecoration: "none" }}>
          <Typography component="span" sx={{ color: T.gold, fontWeight: 600, fontSize: "0.83rem" }}>
            ← Back to Sign In
          </Typography>
        </Link>
      </Box>

      {/* ── Success Dialog ── */}
      <Dialog open={open} onClose={() => setOpen(false)}
        PaperProps={{ sx: { borderRadius: 3, overflow: "hidden", minWidth: 320 } }}>
        <Box sx={{ height: 4, bgcolor: T.gold }} />
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pt: 3,
          fontFamily: "'Georgia', serif", color: T.navy, fontWeight: 700 }}>
          <MarkEmailReadIcon sx={{ color: T.gold, fontSize: 28 }} />
          Check your inbox
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color={T.muted} sx={{ lineHeight: 1.7 }}>
            If an account exists for <Box component="span" fontWeight={700} color={T.navy}>{email}</Box>,
            a password reset link has been sent. Check your inbox and spam folder.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => setOpen(false)}
            sx={{ color: T.muted, textTransform: "none", borderRadius: 2 }}>
            Close
          </Button>
          <Button onClick={() => navigate("/login")} variant="contained"
            sx={{ ...btnSx, mt: 0, px: 3 }}>
            Back to Sign In
          </Button>
        </DialogActions>
      </Dialog>
    </AuthLayout>
  );
}
