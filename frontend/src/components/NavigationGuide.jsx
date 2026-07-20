import { Box, Typography, Paper, Chip } from "@mui/material";

export default function NavigationGuide({ callNumber }) {
  if (!callNumber) return null;

  // 🔥 Simple parsing logic
  const section = callNumber.split(" ")[0]; // QA76
  const row = Math.floor(Math.random() * 5) + 1; // mock row for now

  return (
    <Paper
      sx={{
        p: 2,
        mt: 2,
        borderRadius: 3,
        bgcolor: "#e3f2fd",
      }}
    >
      <Typography fontWeight="bold" mb={1}>
        📍 Library Navigation Guide
      </Typography>

      <Box display="flex" gap={1} flexWrap="wrap" mb={1}>
        <Chip label={`Section: ${section}`} color="primary" />
        <Chip label={`Row: ${row}`} />
        <Chip label="Position: Middle shelf" />
      </Box>

      <Typography variant="body2" color="text.secondary">
        ➡ Walk straight → Turn right → Locate shelf <b>{section}</b>
      </Typography>
    </Paper>
  );
}