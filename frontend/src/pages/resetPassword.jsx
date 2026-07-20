// src/pages/resetPassword.jsx
import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  TextField, Button, Box, Alert, CircularProgress,
  Typography, IconButton, InputAdornment,
} from "@mui/material";
import Visibility    from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import LockResetIcon from "@mui/icons-material/LockReset";
import API from "../api/authApi";
import AuthLayout, { T, fieldSx, btnSx } from "../components/AuthLayout";

export default function ResetPassword() {
  const { token } = useParams();
  const navigate  = useNavigate();

  const [form, setForm]           = useState({ password: "", confirmPassword: "" });
  const [loading, setLoading]     = useState(false);
  const [message, setMessage]     = useState({ text: "", type: "error" });
  const [showPw,  setShowPw]      = useState(false);
  const [showCf,  setShowCf]      = useState(false);
  const [done,    setDone]        = useState(false);

  useEffect(() => {
    if (!token) setMessage({ text: "Invalid or missing reset token.", type: "error" });
  }, [token]);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });
  const passwordMismatch = form.confirmPassword && form.password !== form.confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword)
      return setMessage({ text: "Passwords do not match", type: "error" });

    setLoading(true);
    setMessage({ text: "", type: "error" });

    try {
      const res = await API.post(`/auth/reset-password/${token}`, { password: form.password });
      setMessage({ text: res.data.message || "Password reset successful!", type: "success" });
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setMessage({
        text: err.response?.data?.message || "Reset failed. The link may be expired or invalid.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Set new password" subtitle="Choose a strong password for your account">

      {message.text && (
        <Alert severity={message.type} sx={{ mb: 2.5, borderRadius: 2, fontSize: "0.83rem" }}>
          {message.text}
          {message.type === "success" && (
            <Typography variant="caption" display="block" sx={{ mt: 0.5, color: T.success }}>
              Redirecting to sign in…
            </Typography>
          )}
        </Alert>
      )}

      {!done && (
        <Box component="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap={2}>
          <TextField
            fullWidth label="New password" name="password"
            type={showPw ? "text" : "password"}
            value={form.password} onChange={handleChange} required sx={fieldSx}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowPw(!showPw)} sx={{ color: T.muted }}>
                    {showPw ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            fullWidth label="Confirm new password" name="confirmPassword"
            type={showCf ? "text" : "password"}
            value={form.confirmPassword} onChange={handleChange} required
            error={!!passwordMismatch}
            helperText={passwordMismatch ? "Passwords do not match" : ""}
            sx={{ ...fieldSx, "& .MuiFormHelperText-root": { color: T.error, fontSize: "0.75rem" } }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowCf(!showCf)} sx={{ color: T.muted }}>
                    {showCf ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button type="submit" fullWidth variant="contained"
            disabled={loading || !!passwordMismatch || !token} sx={btnSx}>
            {loading
              ? <><CircularProgress size={18} sx={{ mr: 1, color: T.cream }} /> Resetting…</>
              : <><LockResetIcon sx={{ fontSize: 18, mr: 1 }} />Reset Password</>
            }
          </Button>
        </Box>
      )}

      <Box textAlign="center" mt={3}>
        <Link to="/login" style={{ textDecoration: "none" }}>
          <Typography component="span" sx={{ color: T.gold, fontWeight: 600, fontSize: "0.83rem" }}>
            ← Back to Sign In
          </Typography>
        </Link>
      </Box>
    </AuthLayout>
  );
}
