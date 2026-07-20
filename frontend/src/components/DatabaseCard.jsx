import { Card, CardContent, Typography, Chip, Box } from "@mui/material";
import PublicIcon from "@mui/icons-material/Public";
import LockIcon from "@mui/icons-material/Lock";

export default function DatabaseCard({ database }) {
  if (!database) return null; // ← added

  return (
    <Card sx={{ mb: 2, borderRadius: 3, boxShadow: 3 }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1}>
          <PublicIcon fontSize="small" sx={{ color: "#C9A84C" }} />
          <Typography
            component="a"
            href={database.url}
            target="_blank"
            rel="noopener noreferrer"
            variant="h6"
            fontWeight="bold"
            sx={{ color: "#0B1F3A", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
          >
            {database.name}
          </Typography>
        </Box>

        {database.description && (
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {database.description}
          </Typography>
        )}

        {database.accessNote && (
          <Box display="flex" alignItems="center" gap={0.5} mt={1}>
            <LockIcon sx={{ fontSize: 14, color: "#b8860b" }} />
            <Typography variant="caption" sx={{ color: "#b8860b", fontWeight: 600 }}>
              {database.accessNote}
            </Typography>
          </Box>
        )}

        {database.faculties?.length > 0 && (
          <Box mt={1}>
            {database.faculties.slice(0, 3).map((f, i) => (
              <Chip key={i} label={f} size="small" sx={{ mr: 1, mt: 0.5 }} />
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}