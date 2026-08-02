// src/pages/register.jsx

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
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

const ROLES = ["student", "visitor", "staff"];

const selectSx = {
  borderRadius: 3,
  bgcolor: "#fff",
  fontFamily: "'Georgia', serif",

  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "#D6CFC0",
  },

  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "#C9A84C",
  },

  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "#C9A84C",
    borderWidth: 2,
  },

  "& .MuiSelect-select": {
    padding: "15px 14px",
    fontSize: "0.92rem",
  },
};

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "student",
  });

  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState({
    text: "",
    type: "error",
  });

  const [showPassword, setShowPw] = useState(false);
  const [showConfirm, setShowCf] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const passwordMismatch =
    form.confirmPassword &&
    form.password !== form.confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      return setMessage({
        text: "Passwords do not match",
        type: "error",
      });
    }

    setLoading(true);

    setMessage({
      text: "",
      type: "error",
    });

    try {
      const res = await API.post("/auth/register", {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
      });

      setMessage({
        text:
          res.data.message ||
          "Account created! Check your email to verify.",
        type: "success",
      });

      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      setMessage({
        text:
          err.response?.data?.message ||
          "Registration failed. Please try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create account"
      subtitle="Join the University of Jos Library Intelligence System"
    >
      {/* Alerts */}
      {message.text && (
        <Alert
          severity={message.type}
          sx={{
            mb: 3,
            borderRadius: 3,
            fontSize: "0.85rem",
            alignItems: "center",
          }}
        >
          {message.text}
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
        {/* Full Name */}
        <Box>
          <Typography
            sx={{
              mb: 0.8,
              color: T.navy,
              fontWeight: 600,
              fontSize: "0.86rem",
            }}
          >
            Full Name
          </Typography>

          <TextField
            fullWidth
            name="name"
            placeholder="Enter your full name"
            value={form.name}
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

        {/* Role */}
        <Box>
          <Typography
            sx={{
              mb: 0.8,
              color: T.navy,
              fontWeight: 600,
              fontSize: "0.86rem",
            }}
          >
            Role
          </Typography>

          <FormControl fullWidth>
            <Select
              name="role"
              value={form.role}
              onChange={handleChange}
              sx={selectSx}
            >
              {ROLES.map((r) => (
                <MenuItem
                  key={r}
                  value={r}
                  sx={{
                    fontFamily: "'Georgia', serif",
                    fontSize: "0.9rem",
                    textTransform: "capitalize",
                  }}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
                      setShowPw(!showPassword)
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
        </Box>

        {/* Confirm Password */}
        <Box>
          <Typography
            sx={{
              mb: 0.8,
              color: T.navy,
              fontWeight: 600,
              fontSize: "0.86rem",
            }}
          >
            Confirm Password
          </Typography>

          <TextField
            fullWidth
            name="confirmPassword"
            type={showConfirm ? "text" : "password"}
            placeholder="Confirm your password"
            value={form.confirmPassword}
            onChange={handleChange}
            required
            error={!!passwordMismatch}
            helperText={
              passwordMismatch
                ? "Passwords do not match"
                : ""
            }
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

              "& .MuiFormHelperText-root": {
                color: "#d32f2f",
                fontSize: "0.76rem",
                marginLeft: "2px",
                marginTop: "6px",
              },
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() =>
                      setShowCf(!showConfirm)
                    }
                    sx={{
                      color: T.muted,
                    }}
                  >
                    {showConfirm ? (
                      <VisibilityOff fontSize="small" />
                    ) : (
                      <Visibility fontSize="small" />
                    )}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* Submit */}
        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={loading || !!passwordMismatch}
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
              Creating account…
            </>
          ) : (
            "Create Account"
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

      {/* Bottom */}
      <Typography
        align="center"
        sx={{
          fontSize: "0.9rem",
          color: T.muted,
        }}
      >
        Already have an account?{" "}
        <Link
          to="/login"
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
            Sign In
          </Typography>
        </Link>
      </Typography>
    </AuthLayout>
  );
}