// src/pages/login.jsx

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  Divider,
  Typography,
} from "@mui/material";

import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import API from "../api/authApi";
import AuthLayout, {
  T,
  fieldSx,
  btnSx,
} from "../components/AuthLayout";

export default function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const res = await API.post("/auth/login", form);

      localStorage.setItem("token", res.data.token);

      localStorage.setItem(
        "user",
        JSON.stringify(res.data.data?.user || res.data.user)
      );

      setMessage("success");

      navigate("/");
    } catch (err) {
      setMessage(
        err.response?.data?.message ||
          "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to access your library assistant"
    >
      {/* Alerts */}
      {message && message !== "success" && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            borderRadius: 3,
            fontSize: "0.85rem",
            alignItems: "center",
          }}
        >
          {message}
        </Alert>
      )}

      {message === "success" && (
        <Alert
          severity="success"
          sx={{
            mb: 3,
            borderRadius: 3,
            fontSize: "0.85rem",
            alignItems: "center",
          }}
        >
          Login successful — redirecting…
        </Alert>
      )}

      {/* Form */}
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 2.5,
          mt: 1,
        }}
      >
        {/* Email */}
        <Box>
          <Typography
            sx={{
              mb: 0.8,
              color: T.navy,
              fontWeight: 600,
              fontSize: "0.86rem",
            }}
          >
            Email Address
          </Typography>

          <TextField
            fullWidth
            name="email"
            type="email"
            placeholder="Enter your email address"
            value={form.email}
            onChange={handleChange}
            required
            sx={{
              ...fieldSx,

              "& .MuiOutlinedInput-root": {
                minHeight: 54,
                borderRadius: 3,
                backgroundColor: "#fff",
              },

              "& .MuiInputBase-input": {
                padding: "15px 14px",
                fontSize: "0.92rem",
              },
            }}
          />
        </Box>

        {/* Password */}
        <Box>
          <Typography
            sx={{
              mb: 0.8,
              color: T.navy,
              fontWeight: 600,
              fontSize: "0.86rem",
            }}
          >
            Password
          </Typography>

          <TextField
            fullWidth
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            value={form.password}
            onChange={handleChange}
            required
            sx={{
              ...fieldSx,

              "& .MuiOutlinedInput-root": {
                minHeight: 54,
                borderRadius: 3,
                backgroundColor: "#fff",
              },

              "& .MuiInputBase-input": {
                padding: "15px 14px",
                fontSize: "0.92rem",
              },
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                    sx={{
                      color: T.muted,
                    }}
                  >
                    {showPassword ? (
                      <VisibilityOff fontSize="small" />
                    ) : (
                      <Visibility fontSize="small" />
                    )}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Box
            sx={{
              mt: 1,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <Link
              to="/forgot-password"
              style={{
                textDecoration: "none",
              }}
            >
              <Typography
                sx={{
                  color: T.gold,
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  transition: "0.2s",

                  "&:hover": {
                    textDecoration: "underline",
                    opacity: 0.9,
                  },
                }}
              >
                Forgot password?
              </Typography>
            </Link>
          </Box>
        </Box>

        {/* Submit Button */}
        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={loading}
          sx={{
            ...btnSx,
            mt: 1,
            height: 52,
            borderRadius: 3,
            fontSize: "0.95rem",
            fontWeight: 700,
            letterSpacing: 0.3,
            textTransform: "none",
          }}
        >
          {loading ? (
            <>
              <CircularProgress
                size={18}
                sx={{
                  mr: 1,
                  color: T.cream,
                }}
              />
              Signing in…
            </>
          ) : (
            "Sign In"
          )}
        </Button>
      </Box>

      {/* Divider */}
      <Divider
        sx={{
          my: 4,
          borderColor: T.border,
        }}
      />

      {/* Bottom Text */}
      <Typography
        align="center"
        sx={{
          fontSize: "0.9rem",
          color: T.muted,
        }}
      >
        Don&apos;t have an account?{" "}
        <Link
          to="/register"
          style={{
            textDecoration: "none",
          }}
        >
          <Typography
            component="span"
            sx={{
              color: T.gold,
              fontWeight: 700,
              fontSize: "0.9rem",

              "&:hover": {
                textDecoration: "underline",
              },
            }}
          >
            Register
          </Typography>
        </Link>
      </Typography>
    </AuthLayout>
  );
}