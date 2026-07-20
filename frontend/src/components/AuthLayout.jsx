// src/components/AuthLayout.jsx

import { Box, Typography } from "@mui/material";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import { useNavigate } from "react-router-dom";

export const T = {
  navy: "#0B1F3A",
  navyLight: "#162d52",
  gold: "#C9A84C",
  goldLight: "#e8c96a",
  cream: "#F8F4EC",
  creamDark: "#EDE8DC",
  border: "#D6CFC0",
  muted: "#6b7280",
  white: "#ffffff",
  error: "#c0392b",
  success: "#2d7a4f",
};

// Shared styled TextField sx
export const fieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: 2,
    bgcolor: "#fdfcf8",
    fontFamily: "'Georgia', serif",
    fontSize: "0.92rem",

    "& fieldset": {
      borderColor: "#D6CFC0",
    },

    "&:hover fieldset": {
      borderColor: "#C9A84C",
    },

    "&.Mui-focused fieldset": {
      borderColor: "#C9A84C",
      borderWidth: 2,
    },
  },

  "& .MuiInputLabel-root.Mui-focused": {
    color: "#C9A84C",
  },
};

// Shared submit button sx
export const btnSx = {
  mt: 2.5,
  py: 1.4,
  borderRadius: 2,

  textTransform: "none",

  fontFamily: "'Georgia', serif",
  fontSize: "0.95rem",
  fontWeight: 700,

  bgcolor: "#0B1F3A",
  color: "#F8F4EC",

  boxShadow: "0 4px 14px rgba(11,31,58,0.25)",

  "&:hover": {
    bgcolor: "#162d52",
    boxShadow: "0 6px 20px rgba(11,31,58,0.3)",
  },

  "&.Mui-disabled": {
    bgcolor: "#D6CFC0",
    color: "#6b7280",
  },

  transition: "all 0.2s",
};

export default function AuthLayout({
  children,
  title,
  subtitle,
}) {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: "100%",
        minHeight: "100dvh",
        
        overflowY: "auto",
        overflowX: "hidden",

        bgcolor: T.navy,

        backgroundImage: `
          radial-gradient(
            ellipse at 70% 10%,
            ${T.navyLight} 0%,
            ${T.navy} 65%
          )
        `,

        display: "flex",
        flexDirection: "column",

        alignItems: "center",
        justifyContent: "flex-start",

        px: 2,

        py: {
          xs: 4,
          md: 5,
        },
      }}
    >
      {/* Brand */}
      <Box
        display="flex"
        alignItems="center"
        gap={1.2}
        mb={3}
        sx={{
          cursor: "pointer",

          "&:hover": {
            opacity: 0.85,
          },

          transition: "opacity 0.15s",
        }}
        onClick={() => navigate("/")}
      >
        <AutoStoriesIcon
          sx={{
            color: T.gold,
            fontSize: 28,
          }}
        />

        <Box>
          <Typography
            variant="subtitle1"
            fontWeight={700}
            color={T.cream}
            sx={{
              fontFamily: "'Georgia', serif",
              lineHeight: 1,
            }}
          >
            UNIJOS Library
          </Typography>

          <Typography
            variant="caption"
            color={T.gold}
            sx={{
              fontSize: "0.58rem",
              letterSpacing: 1.8,
            }}
          >
           Library Expert System Model
          </Typography>
        </Box>
      </Box>

      {/* Card */}
      <Box
        sx={{
          width: "100%",
          maxWidth: 440,

          bgcolor: T.white,

          borderRadius: 4,

          boxShadow:
            "0 24px 64px rgba(0,0,0,0.28)",

          overflow: "visible",

          mb: 3,
        }}
      >
        {/* Top border */}
        <Box
          sx={{
            height: 4,
            bgcolor: T.gold,
          }}
        />

        {/* Content */}
        <Box
          sx={{
            p: {
              xs: 3.5,
              sm: 4.5,
            },
          }}
        >
          <Typography
            variant="h4"
            fontWeight={700}
            color={T.navy}
            sx={{
              fontFamily: "'Georgia', serif",
              mb: 1,
              fontSize: {
                xs: "2rem",
                sm: "2.2rem",
              },
            }}
          >
            {title}
          </Typography>

          {subtitle && (
            <Typography
              variant="body2"
              color={T.muted}
              sx={{
                mb: 3.5,
                fontSize: "0.92rem",
                lineHeight: 1.6,
              }}
            >
              {subtitle}
            </Typography>
          )}

          {children}
        </Box>
      </Box>

      {/* Footer */}
      <Typography
        variant="caption"
        color={T.muted}
        sx={{
          fontSize: "0.7rem",
          textAlign: "center",
          pb: 1,
        }}
      >
        University of Jos · Library Expert System Model
      </Typography>
    </Box>
  );
}