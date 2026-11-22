// src/components/ProfileModal.jsx
import { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  MenuItem, Autocomplete, Alert, Typography, Box, CircularProgress,
} from "@mui/material";
import API from "../api/authApi";

const T = { navy: "#0B1F3A", gold: "#C9A84C", goldLight: "#e8c96a", cream: "#F8F4EC", border: "#D6CFC0", muted: "#6b7280" };
const EMPTY = { department: "", course: "", level: "", dateOfBirth: "", stateOfOrigin: "" };

const maxDob = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 14); return d.toISOString().slice(0, 10); };

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: 2, bgcolor: "#fff",
    "& fieldset": { borderColor: T.border },
    "&:hover fieldset": { borderColor: T.gold },
    "&.Mui-focused fieldset": { borderColor: T.gold, borderWidth: 2 },
  },
};

export default function ProfileModal({ open, initial, isComplete, onSaved, onSnooze, onClose }) {
  const [opts, setOpts]     = useState({ departments: [], levels: [], states: [] });
  const [form, setForm]     = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY, ...(initial || {}) });
    setErrors({}); setError("");
    if (opts.departments.length) return;
    API.get("/profile/options")
      .then((r) => setOpts({ departments: r.data.departments, levels: r.data.levels, states: r.data.states }))
      .catch(() => setError("Couldn't load the form options. Please try again."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k) => (v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  const submit = async (e) => {
    e?.preventDefault();
    setSaving(true); setError(""); setErrors({});
    try {
      const res = await API.put("/profile", form);
      onSaved(res.data.profile);
    } catch (err) {
      setErrors(err.response?.data?.errors || {});
      setError(err.response?.data?.message || "Could not save your profile. Please try again.");
    } finally { setSaving(false); }
  };

  const deptObj = opts.departments.find((d) => d.name === form.department) || null;

  return (
    <Dialog open={open} onClose={isComplete ? onClose : undefined} fullWidth maxWidth="sm"
      slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <form onSubmit={submit}>
        <DialogTitle sx={{ fontFamily: "'Georgia', serif", color: T.navy, fontWeight: 700 }}>
          {isComplete ? "Your profile" : "Tell us about yourself"}
          <Typography variant="body2" sx={{ color: T.muted, mt: 0.5, fontWeight: 400 }}>
            This helps the assistant suggest books for your course and level.
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ pt: "16px !important" }}>
  {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

  <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
    <Autocomplete
      fullWidth
      options={opts.departments}
      groupBy={(o) => o.faculty}
      getOptionLabel={(o) => o.name}
      isOptionEqualToValue={(a, b) => a.name === b.name}
      value={deptObj}
      onChange={(_, v) => set("department")(v?.name || "")}
      renderInput={(p) => (
        <TextField {...p} label="Department" required error={!!errors.department}
          helperText={errors.department || (deptObj ? `Faculty of ${deptObj.faculty}` : " ")}
          sx={fieldSx} />
      )}
    />

    <TextField fullWidth label="Course of study" required placeholder="e.g. B.Pharm Pharmacy"
      value={form.course} onChange={(e) => set("course")(e.target.value)}
      error={!!errors.course} helperText={errors.course} sx={fieldSx} />

    <TextField fullWidth select label="Level" required value={form.level}
      onChange={(e) => set("level")(e.target.value)}
      error={!!errors.level} helperText={errors.level} sx={fieldSx}>
      {opts.levels.map((l) => (
        <MenuItem key={l} value={l}>{/^\d/.test(l) ? `${l} level` : l}</MenuItem>
      ))}
    </TextField>

    <TextField fullWidth label="Date of birth" type="date" required value={form.dateOfBirth}
      onChange={(e) => set("dateOfBirth")(e.target.value)}
      error={!!errors.dateOfBirth} helperText={errors.dateOfBirth} sx={fieldSx}
      slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: maxDob() } }} />

    <Autocomplete
      fullWidth
      options={opts.states}
      value={form.stateOfOrigin || null}
      onChange={(_, v) => set("stateOfOrigin")(v || "")}
      renderInput={(p) => (
        <TextField {...p} label="State of origin" required error={!!errors.stateOfOrigin}
          helperText={errors.stateOfOrigin} sx={fieldSx} />
      )}
    />

    <Typography variant="caption" sx={{ color: T.muted }}>
      Your details are used only to personalise your library experience and are never shared with AI providers.
    </Typography>
  </Box>
</DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={isComplete ? onClose : onSnooze} sx={{ color: T.muted, textTransform: "none" }}>
            {isComplete ? "Cancel" : "Remind me later"}
          </Button>
          <Button type="submit" variant="contained" disabled={saving}
            sx={{ bgcolor: T.gold, color: T.navy, fontWeight: 700, textTransform: "none", borderRadius: 2, px: 3,
              "&:hover": { bgcolor: T.goldLight } }}>
            {saving ? <CircularProgress size={18} sx={{ color: T.navy }} /> : "Save profile"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
