import { Box, Typography, Paper, Chip, IconButton } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

export default function SearchHistory({ history = [], onSelect, onDelete }) {
  if (!history.length) return null;

  // 🧠 Format time
 const formatTime = (timestamp) => {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  if (isNaN(date)) return "";

  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;

  return date.toLocaleDateString();
};

  return (
    <Paper
      sx={{
        p: 2,
        mb: 3,
        borderRadius: 3,
        bgcolor: "#fafafa",
      }}
    >
      <Typography fontWeight="bold" mb={2}>
        📜 Recent Searches
      </Typography>

      <Box display="flex" flexWrap="wrap" gap={1}>
        {history.map((item, i) => (
          <Box key={i} display="flex" alignItems="center">
            
            {/* 🔍 Query Chip */}
            <Chip
              label={item.query}
              onClick={() => onSelect(item.query)}
              sx={{
                cursor: "pointer",
                "&:hover": {
                  backgroundColor: "#e3f2fd",
                },
              }}
            />

            {/* 🕒 Time */}
            <Typography
              variant="caption"
              sx={{ ml: 1, color: "gray" }}
            >
              {formatTime(item.timestamp)}
            </Typography>

            {/* ❌ Delete */}
            {onDelete && (
              <IconButton
                size="small"
                onClick={() => onDelete(item.query)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        ))}
      </Box>
    </Paper>
  );
}