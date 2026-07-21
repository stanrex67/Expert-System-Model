// src/pages/AdminDashboard.jsx
// Full admin panel — consumes all /api/admin/* endpoints
// Same navy/gold/cream theme as the main dashboard

import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Chip, Avatar, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, Button, Divider, LinearProgress,
  Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions,
  Badge,
} from "@mui/material";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import PeopleIcon          from "@mui/icons-material/People";
import MenuBookIcon        from "@mui/icons-material/MenuBook";
import QueryStatsIcon      from "@mui/icons-material/QueryStats";
import CheckCircleIcon     from "@mui/icons-material/CheckCircle";
import ErrorIcon           from "@mui/icons-material/Error";
import SpeedIcon           from "@mui/icons-material/Speed";
import DeleteIcon          from "@mui/icons-material/Delete";
import LogoutIcon          from "@mui/icons-material/Logout";
import UploadFileIcon      from "@mui/icons-material/UploadFile";
import RefreshIcon         from "@mui/icons-material/Refresh";
import AutoStoriesIcon     from "@mui/icons-material/AutoStories";
import TrendingUpIcon      from "@mui/icons-material/TrendingUp";
import WarningAmberIcon    from "@mui/icons-material/WarningAmber";
import PersonOffIcon       from "@mui/icons-material/PersonOff";
import { useNavigate }     from "react-router-dom";
import API from "../api/authApi";

// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
  navy:      "#0B1F3A",
  navyLight: "#162d52",
  navyMid:   "#1a3460",
  gold:      "#C9A84C",
  goldLight: "#e8c96a",
  cream:     "#F8F4EC",
  creamDark: "#EDE8DC",
  muted:     "#6b7280",
  white:     "#ffffff",
  border:    "#D6CFC0",
  success:   "#2d7a4f",
  error:     "#c0392b",
  successBg: "#e8f5ee",
  errorBg:   "#fdf0ee",
};

const CHART_COLORS = [T.gold, T.navy, "#8b7355", "#4a7c59", "#7b5ea7", "#c67b5c"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString();
const fmtMs = (ms) => ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Number(ms || 0).toFixed(0)}ms`;
const fmtDate = (d) => d ? new Date(d).toLocaleString() : "—";
const getStoredUser = () => {
  try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
};

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color = T.gold, loading }) {
  return (
    <Box sx={{
      bgcolor: T.white, borderRadius: 2.5,
      border: `1px solid ${T.border}`,
      p: 2.5, display: "flex", alignItems: "flex-start", gap: 2,
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      transition: "box-shadow 0.2s, border-color 0.2s",
      "&:hover": { boxShadow: "0 4px 16px rgba(11,31,58,0.1)", borderColor: T.gold },
    }}>
      <Box sx={{
        width: 44, height: 44, borderRadius: 2,
        bgcolor: color + "18",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {icon}
      </Box>
      <Box>
        <Typography variant="caption" sx={{ color: T.muted, letterSpacing: 0.5, fontSize: "0.72rem" }}>
          {label}
        </Typography>
        {loading
          ? <CircularProgress size={18} sx={{ color, mt: 0.5 }} />
          : <Typography variant="h5" fontWeight={700} color={T.navy}
              sx={{ fontFamily: "'Georgia', serif", lineHeight: 1.2 }}>
              {value}
            </Typography>
        }
        {sub && !loading && (
          <Typography variant="caption" sx={{ color: T.muted, fontSize: "0.7rem" }}>{sub}</Typography>
        )}
      </Box>
    </Box>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, action, children }) {
  return (
    <Box sx={{ bgcolor: T.white, borderRadius: 2.5, border: `1px solid ${T.border}`, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <Box sx={{ px: 2.5, py: 1.8, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ fontWeight: 700, color: T.navy, fontFamily: "'Georgia', serif", fontSize: "0.95rem", display: "flex", alignItems: "center" }}>
          {title}
        </Box>
        {action}
      </Box>
      <Box sx={{ p: 2.5 }}>{children}</Box>
    </Box>
  );
}

// ─── Intent badge ─────────────────────────────────────────────────────────────
function IntentChip({ label }) {
  const colors = {
    FIND_BOOK:      { bg: "#e8f0fe", color: "#1a56db" },
    LOCATE_BOOK:    { bg: "#fef3e8", color: "#c47a1e" },
    RECOMMEND_BOOK: { bg: "#f0fdf4", color: "#2d7a4f" },
    LIBRARY_INFO:   { bg: "#f5f3ff", color: "#6d35c9" },
    LOCATION_INFO:  { bg: "#fff8e1", color: "#b45309" },
    GREETING:       { bg: "#fce7f3", color: "#be185d" },
    GENERAL_HELP:   { bg: "#f1f5f9", color: "#475569" },
  };
  const c = colors[label] || { bg: T.creamDark, color: T.navy };
  return (
    <Chip label={label} size="small" sx={{
      bgcolor: c.bg, color: c.color, fontWeight: 600,
      fontSize: "0.62rem", height: 18, border: "none",
    }} />
  );
}

// ─── Main AdminDashboard ──────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const user     = getStoredUser();
  const [tab, setTab] = useState(0);

  // ── Data state ──────────────────────────────────────────────────────────
  const [overview,    setOverview]    = useState(null);
  const [stats,       setStats]       = useState(null);
  const [users,       setUsers]       = useState([]);
  const [logs,        setLogs]        = useState([]);
  const [logMeta,     setLogMeta]     = useState({ total: 0, page: 1, pages: 1 });
  const [topQueries,  setTopQueries]  = useState([]);
  const [intents,     setIntents]     = useState([]);
  const [failures,    setFailures]    = useState([]);
  const [dailyUsage,  setDailyUsage]  = useState([]);
  const [authStats,   setAuthStats]   = useState(null);
  const [performance, setPerformance] = useState(null);

  const [loadingMap,  setLoadingMap]  = useState({});
  const [errors,      setErrors]      = useState({});
  const [deleteError, setDeleteError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  // ── Log filters ─────────────────────────────────────────────────────────
  const [logFilters, setLogFilters] = useState({
    type: "", success: "", page: 1, limit: 15,
  });

  // ── Book upload ─────────────────────────────────────────────────────────
  const [uploadText,   setUploadText]   = useState("");
  const [uploadResult, setUploadResult] = useState(null);
  const [uploading,    setUploading]    = useState(false);

  // ── Delete user dialog ──────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ── Fetch helpers ────────────────────────────────────────────────────────
  const setLoading = (key, val) => setLoadingMap(m => ({ ...m, [key]: val }));
  const setError   = (key, val) => setErrors(m => ({ ...m, [key]: val }));

  const fetch_ = useCallback(async (key, call, setter) => {
    setLoading(key, true);
    setError(key, null);
    try {
      const res = await call();
      setter(res.data);
    } catch (e) {
      setError(key, e?.response?.data?.message || "Failed to load");
    } finally {
      setLoading(key, false);
    }
  }, []);

  // ── Load all data on mount ───────────────────────────────────────────────
  const loadAll = useCallback(() => {
    fetch_("overview",    () => API.get("/admin/overview"),    setOverview);
    fetch_("stats",       () => API.get("/admin/stats"),       setStats);
    fetch_("users",       () => API.get("/admin/users"),       setUsers);
    fetch_("topQueries",  () => API.get("/admin/top-queries"), setTopQueries);
    fetch_("intents",     () => API.get("/admin/intents"),     setIntents);
    fetch_("failures",    () => API.get("/admin/failures"),    setFailures);
    fetch_("dailyUsage",  () => API.get("/admin/daily-usage"), setDailyUsage);
    fetch_("authStats",   () => API.get("/admin/auth-stats"),  setAuthStats);
    fetch_("performance", () => API.get("/admin/performance"), setPerformance);
  }, [fetch_]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Load logs (with filters + pagination) ───────────────────────────────
  const loadLogs = useCallback(() => {
    const params = new URLSearchParams();
    Object.entries(logFilters).forEach(([k, v]) => { if (v !== "") params.set(k, v); });
    fetch_("logs", () => API.get(`/admin/logs?${params}`), (data) => {
      setLogs(data.results || []);
      setLogMeta({ total: data.total, page: data.page, pages: data.pages });
    });
  }, [logFilters, fetch_]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // ── Delete user ──────────────────────────────────────────────────────────

const confirmDelete = async () => {
  if (!deleteTarget) return;
  setDeleting(true);
  setDeleteError(null);
  try {
    await API.delete(`/admin/users/${deleteTarget._id}`);
    setUsers(prev => prev.filter(u => u._id !== deleteTarget._id));
    setDeleteTarget(null);
  } catch (e) {
    setDeleteError(e?.response?.data?.message || "Failed to delete user.");
  } finally {
    setDeleting(false);
  }
};

  // ── Upload books ─────────────────────────────────────────────────────────
  const handleUpload = async () => {
    setUploading(true);
    setUploadResult(null);
    try {
      const books = JSON.parse(uploadText);
      const res   = await API.post("/admin/upload-books", books);
      setUploadResult({ type: "success", text: res.data.message });
      setUploadText("");
    } catch (e) {
      setUploadResult({ type: "error", text: e?.response?.data?.message || "Upload failed — check JSON format." });
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  // ── Tab panels ───────────────────────────────────────────────────────────
  const TABS = ["Overview", "Users", "Logs", "Analytics", "Upload Books"];

  return (
    <Box sx={{
      display: "flex", width: "100%", height: "100vh",
      bgcolor: T.cream, overflow: "hidden",
    }}>

      {/* ══ SIDEBAR ══════════════════════════════════════════════════════════ */}
      <Box sx={{
        width: 220, flexShrink: 0,
        bgcolor: T.navy,
        display: "flex", flexDirection: "column",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}>
        {/* Brand */}
        <Box sx={{ p: 2.5, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Box display="flex" alignItems="center" gap={1.2}>
            <AutoStoriesIcon sx={{ color: T.gold, fontSize: 22 }} />
            <Box>
              <Typography variant="subtitle2" fontWeight={700} color={T.cream}
                sx={{ fontFamily: "'Georgia', serif", lineHeight: 1.1 }}>
                UNIJOS Library
              </Typography>
              <Typography variant="caption" color={T.gold}
                sx={{ fontSize: "0.55rem", letterSpacing: 1.4 }}>
                ADMIN PANEL
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Nav tabs */}
        <Box sx={{ flex: 1, py: 1, px: 1 }}>
          {TABS.map((t, i) => (
            <Box key={t} onClick={() => setTab(i)} sx={{
              px: 1.5, py: 1, mb: 0.3, borderRadius: 1.5,
              cursor: "pointer",
              bgcolor: tab === i ? "rgba(201,168,76,0.15)" : "transparent",
              borderLeft: tab === i ? `3px solid ${T.gold}` : "3px solid transparent",
              transition: "all 0.15s",
              "&:hover": { bgcolor: "rgba(201,168,76,0.1)" },
            }}>
              <Typography sx={{
                fontSize: "0.82rem", color: tab === i ? T.gold : "rgba(248,244,236,0.65)",
                fontWeight: tab === i ? 700 : 400,
                fontFamily: "'Georgia', serif",
              }}>
                {t}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* User footer */}
        <Box sx={{
          p: 1.5, borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 1,
        }}>
          <Avatar sx={{ bgcolor: T.gold, color: T.navy, width: 28, height: 28, fontSize: "0.75rem", fontWeight: 700 }}>
            {user.name?.[0]?.toUpperCase() || "A"}
          </Avatar>
          <Box flex={1} minWidth={0}>
            <Typography variant="caption" fontWeight={600} color={T.cream}
              sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.75rem" }}>
              {user.name || "Admin"}
            </Typography>
            <Chip label="Admin" size="small" sx={{
              bgcolor: "rgba(201,168,76,0.2)", color: T.gold,
              fontSize: "0.55rem", height: 14, fontWeight: 700,
            }} />
          </Box>
          <Tooltip title="Sign out">
            <IconButton size="small" onClick={handleLogout}
              sx={{ color: "rgba(255,255,255,0.3)", "&:hover": { color: "#e74c3c" } }}>
              <LogoutIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ══ MAIN CONTENT ═════════════════════════════════════════════════════ */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <Box sx={{
          px: 3, py: 1.5, bgcolor: T.white,
          borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", gap: 2,
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)", flexShrink: 0,
        }}>
          <Typography fontWeight={700} color={T.navy} flex={1}
            sx={{ fontFamily: "'Georgia', serif", fontSize: "1rem" }}>
            {TABS[tab]}
          </Typography>
          <Tooltip title="Refresh all data">
            <IconButton size="small" onClick={loadAll}
              sx={{ color: T.muted, "&:hover": { color: T.gold } }}>
              <RefreshIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Button component="a" href="/" size="small"
            sx={{ color: T.muted, textTransform: "none", fontSize: "0.78rem",
              "&:hover": { color: T.navy } }}>
            ← Back to Library
          </Button>
        </Box>

        {/* Scrollable content */}
        <Box sx={{
          flex: 1, overflowY: "auto", p: 3,
          "&::-webkit-scrollbar": { width: 5 },
          "&::-webkit-scrollbar-thumb": { bgcolor: T.border, borderRadius: 3 },
        }}>

          {/* ══ TAB 0: OVERVIEW ════════════════════════════════════════════ */}
          {tab === 0 && (
            <Box display="flex" flexDirection="column" gap={3}>

              {/* Stat cards grid */}
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 2 }}>
                <StatCard icon={<PeopleIcon sx={{ color: T.gold, fontSize: 22 }} />}
                  label="Total Users" value={fmt(stats?.totalUsers)}
                  loading={loadingMap.stats} />
                <StatCard icon={<MenuBookIcon sx={{ color: T.navy, fontSize: 22 }} />}
                  label="Total Books" value={fmt(stats?.totalBooks)}
                  color={T.navy} loading={loadingMap.stats} />
                <StatCard icon={<QueryStatsIcon sx={{ color: "#7b5ea7", fontSize: 22 }} />}
                  label="Total Queries" value={fmt(overview?.totalQueries)}
                  color="#7b5ea7" loading={loadingMap.overview} />
                <StatCard icon={<CheckCircleIcon sx={{ color: T.success, fontSize: 22 }} />}
                  label="Success Rate" value={`${overview?.successRate ?? "—"}%`}
                  sub={`${fmt(overview?.successful)} successful`}
                  color={T.success} loading={loadingMap.overview} />
                <StatCard icon={<ErrorIcon sx={{ color: T.error, fontSize: 22 }} />}
                  label="Failed Queries" value={fmt(overview?.failed)}
                  color={T.error} loading={loadingMap.overview} />
                <StatCard icon={<SpeedIcon sx={{ color: "#c67b5c", fontSize: 22 }} />}
                  label="Avg Response" value={fmtMs(performance?.averageResponseTime)}
                  color="#c67b5c" loading={loadingMap.performance} />
              </Box>

              {/* Auth stats row */}
              {authStats && (
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 2 }}>
                  <StatCard icon={<TrendingUpIcon sx={{ color: T.gold, fontSize: 22 }} />}
                    label="Total Logins" value={fmt(authStats.totalLogins)} />
                  <StatCard icon={<PersonOffIcon sx={{ color: T.error, fontSize: 22 }} />}
                    label="Failed Logins" value={fmt(authStats.failedLogins)} color={T.error} />
                  <StatCard icon={<PeopleIcon sx={{ color: T.success, fontSize: 22 }} />}
                    label="Registrations" value={fmt(authStats.registrations)} color={T.success} />
                </Box>
              )}

              {/* Daily usage chart */}
              <Section title="Daily Query Volume">
                {loadingMap.dailyUsage
                  ? <Box display="flex" justifyContent="center" py={4}><CircularProgress sx={{ color: T.gold }} /></Box>
                  : dailyUsage.length === 0
                    ? <Typography color={T.muted} fontSize="0.85rem">No data yet.</Typography>
                    : (
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={dailyUsage}>
                          <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                          <XAxis dataKey="_id" tick={{ fontSize: 11, fill: T.muted }} />
                          <YAxis tick={{ fontSize: 11, fill: T.muted }} />
                          <RTooltip contentStyle={{ borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12 }} />
                          <Line type="monotone" dataKey="count" stroke={T.gold} strokeWidth={2.5}
                            dot={{ fill: T.gold, r: 3 }} activeDot={{ r: 5 }} name="Queries" />
                        </LineChart>
                      </ResponsiveContainer>
                    )
                }
              </Section>

              {/* Top queries + intent pie */}
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
                <Section title="Top 10 Queries">
                  {loadingMap.topQueries
                    ? <CircularProgress size={24} sx={{ color: T.gold }} />
                    : topQueries.map((q, i) => (
                      <Box key={i} display="flex" alignItems="center" gap={1.5} mb={1}>
                        <Typography sx={{ fontSize: "0.7rem", color: T.muted, width: 18, flexShrink: 0 }}>
                          {i + 1}
                        </Typography>
                        <Box flex={1} minWidth={0}>
                          <Typography sx={{ fontSize: "0.8rem", color: T.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {q._id || "(empty)"}
                          </Typography>
                          <LinearProgress variant="determinate"
                            value={(q.count / (topQueries[0]?.count || 1)) * 100}
                            sx={{ height: 3, borderRadius: 2, mt: 0.3,
                              bgcolor: T.creamDark,
                              "& .MuiLinearProgress-bar": { bgcolor: T.gold } }} />
                        </Box>
                        <Chip label={q.count} size="small" sx={{
                          bgcolor: T.creamDark, color: T.navy,
                          fontSize: "0.65rem", height: 18, flexShrink: 0,
                        }} />
                      </Box>
                    ))
                  }
                </Section>

                <Section title="Intent Distribution">
                  {loadingMap.intents
                    ? <CircularProgress size={24} sx={{ color: T.gold }} />
                    : intents.length === 0
                      ? <Typography color={T.muted} fontSize="0.85rem">No data.</Typography>
                      : (
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie data={intents} dataKey="count" nameKey="_id"
                              cx="50%" cy="50%" outerRadius={80}
                              label={({ _id, percent }) => `${_id?.replace("_BOOK","") ?? ""} ${(percent*100).toFixed(0)}%`}
                              labelLine={false}
                              fontSize={10}>
                              {intents.map((_, i) => (
                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      )
                  }
                </Section>
              </Box>

              {/* Recent failures */}
              <Section title={
                <Box display="flex" alignItems="center" gap={1}>
                  <WarningAmberIcon sx={{ color: T.error, fontSize: 18 }} />
                  Recent Failures
                </Box>
              }>
                {loadingMap.failures
                  ? <CircularProgress size={24} sx={{ color: T.gold }} />
                  : failures.length === 0
                    ? <Typography color={T.muted} fontSize="0.85rem">No recent failures 🎉</Typography>
                    : (
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              {["Time", "Query", "Response"].map(h => (
                                <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.72rem", color: T.muted, py: 0.8 }}>
                                  {h}
                                </TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {failures.map((f, i) => (
                              <TableRow key={i} sx={{ "&:hover": { bgcolor: T.cream } }}>
                                <TableCell sx={{ fontSize: "0.72rem", color: T.muted, whiteSpace: "nowrap", py: 0.8 }}>
                                  {fmtDate(f.createdAt)}
                                </TableCell>
                                <TableCell sx={{ fontSize: "0.78rem", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", py: 0.8 }}>
                                  {f.query || "—"}
                                </TableCell>
                                <TableCell sx={{ fontSize: "0.75rem", color: T.error, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", py: 0.8 }}>
                                  {f.response || "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )
                }
              </Section>
            </Box>
          )}

          {/* ══ TAB 1: USERS ═══════════════════════════════════════════════ */}
          {tab === 1 && (
            <Section title={`All Users (${users.length})`}>
              {loadingMap.users
                ? <Box display="flex" justifyContent="center" py={4}><CircularProgress sx={{ color: T.gold }} /></Box>
                : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {["User", "Email", "Role", "Verified", "Joined", ""].map(h => (
                            <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.72rem", color: T.muted, py: 1 }}>
                              {h}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {users.map((u) => (
                          <TableRow key={u._id} sx={{ "&:hover": { bgcolor: T.cream } }}>
                            <TableCell sx={{ py: 1 }}>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Avatar sx={{ bgcolor: T.gold, color: T.navy, width: 26, height: 26, fontSize: "0.7rem", fontWeight: 700 }}>
                                  {u.name?.[0]?.toUpperCase() || "U"}
                                </Avatar>
                                <Typography sx={{ fontSize: "0.82rem", fontWeight: 600, color: T.navy }}>
                                  {u.name}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell sx={{ fontSize: "0.78rem", color: T.muted }}>{u.email}</TableCell>
                            <TableCell>
                              <Chip label={u.role || "student"} size="small" sx={{
                                bgcolor: u.role === "admin" ? "rgba(201,168,76,0.15)" : T.creamDark,
                                color: u.role === "admin" ? T.gold : T.navy,
                                fontSize: "0.62rem", height: 18, fontWeight: 600,
                              }} />
                            </TableCell>
                            <TableCell>
                              {u.isVerified
                                ? <CheckCircleIcon sx={{ fontSize: 16, color: T.success }} />
                                : <ErrorIcon sx={{ fontSize: 16, color: T.error }} />
                              }
                            </TableCell>
                            <TableCell sx={{ fontSize: "0.72rem", color: T.muted, whiteSpace: "nowrap" }}>
                              {fmtDate(u.createdAt)}
                            </TableCell>
                            <TableCell>
                              <Tooltip title="Delete user">
                                <IconButton size="small"
                                  onClick={() => setDeleteTarget(u)}
                                  sx={{ color: T.muted, "&:hover": { color: T.error, bgcolor: T.errorBg } }}>
                                  <DeleteIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )
              }
            </Section>
          )}

          {/* ══ TAB 2: LOGS ════════════════════════════════════════════════ */}
          {tab === 2 && (
            <Box display="flex" flexDirection="column" gap={2}>

              {/* Filters */}
              <Box display="flex" gap={1.5} flexWrap="wrap" alignItems="center">
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel sx={{ fontSize: "0.82rem" }}>Type</InputLabel>
                  <Select value={logFilters.type}
                    onChange={e => setLogFilters(f => ({ ...f, type: e.target.value, page: 1 }))}
                    label="Type" sx={{ fontSize: "0.82rem" }}>
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="AI">AI</MenuItem>
                    <MenuItem value="AUTH">AUTH</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <InputLabel sx={{ fontSize: "0.82rem" }}>Status</InputLabel>
                  <Select value={logFilters.success}
                    onChange={e => setLogFilters(f => ({ ...f, success: e.target.value, page: 1 }))}
                    label="Status" sx={{ fontSize: "0.82rem" }}>
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="true">Success</MenuItem>
                    <MenuItem value="false">Failed</MenuItem>
                  </Select>
                </FormControl>

                <Button variant="outlined" size="small"
                  onClick={() => setLogFilters({ type: "", success: "", page: 1, limit: 15 })}
                  sx={{ fontSize: "0.75rem", borderColor: T.border, color: T.muted,
                    "&:hover": { borderColor: T.gold, color: T.navy } }}>
                  Clear filters
                </Button>

                <Typography variant="caption" color={T.muted} sx={{ ml: "auto" }}>
                  {fmt(logMeta.total)} total · page {logMeta.page} of {logMeta.pages}
                </Typography>
              </Box>

              <Section title="System Logs">
                {loadingMap.logs
                  ? <Box display="flex" justifyContent="center" py={4}><CircularProgress sx={{ color: T.gold }} /></Box>
                  : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            {["Time", "Type", "User", "Query / Action", "Intent", "Status", "Response (ms)"].map(h => (
                              <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.7rem", color: T.muted, py: 0.8, whiteSpace: "nowrap" }}>
                                {h}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {logs.map((l, i) => (
                            <TableRow key={i} sx={{
                              "&:hover": { bgcolor: T.cream },
                              bgcolor: l.success === false ? "#fff8f8" : "inherit",
                            }}>
                              <TableCell sx={{ fontSize: "0.7rem", color: T.muted, whiteSpace: "nowrap", py: 0.7 }}>
                                {fmtDate(l.createdAt)}
                              </TableCell>
                              <TableCell sx={{ py: 0.7 }}>
                                <Chip label={l.type} size="small" sx={{
                                  bgcolor: l.type === "AI" ? "rgba(201,168,76,0.15)" : "rgba(11,31,58,0.08)",
                                  color: l.type === "AI" ? "#9a6c1a" : T.navy,
                                  fontSize: "0.6rem", height: 16, fontWeight: 700,
                                }} />
                              </TableCell>
                              <TableCell sx={{ fontSize: "0.72rem", color: T.muted, py: 0.7 }}>
                                {l.user?.email || "—"}
                              </TableCell>
                              <TableCell sx={{ maxWidth: 240, py: 0.7 }}>
                                <Typography sx={{ fontSize: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {l.query || l.action || "—"}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ py: 0.7 }}>
                                <Box display="flex" flexWrap="wrap" gap={0.3}>
                                  {(l.intent || []).map((it, j) => <IntentChip key={j} label={it} />)}
                                </Box>
                              </TableCell>
                              <TableCell sx={{ py: 0.7 }}>
                                {l.success
                                  ? <CheckCircleIcon sx={{ fontSize: 15, color: T.success }} />
                                  : <ErrorIcon sx={{ fontSize: 15, color: T.error }} />
                                }
                              </TableCell>
                              <TableCell sx={{ fontSize: "0.72rem", color: T.muted, py: 0.7 }}>
                                {l.responseTime ? `${l.responseTime}ms` : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )
                }

                {/* Pagination */}
                <Box display="flex" justifyContent="flex-end" gap={1} mt={2}>
                  <Button size="small" disabled={logMeta.page <= 1}
                    onClick={() => setLogFilters(f => ({ ...f, page: f.page - 1 }))}
                    sx={{ fontSize: "0.75rem", color: T.navy }}>
                    ← Prev
                  </Button>
                  <Button size="small" disabled={logMeta.page >= logMeta.pages}
                    onClick={() => setLogFilters(f => ({ ...f, page: f.page + 1 }))}
                    sx={{ fontSize: "0.75rem", color: T.navy }}>
                    Next →
                  </Button>
                </Box>
              </Section>
            </Box>
          )}

          {/* ══ TAB 3: ANALYTICS ═══════════════════════════════════════════ */}
          {tab === 3 && (
            <Box display="flex" flexDirection="column" gap={3}>

              {/* Intent bar chart */}
              <Section title="Intent Frequency">
                {loadingMap.intents
                  ? <CircularProgress sx={{ color: T.gold }} />
                  : (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={intents}>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                        <XAxis dataKey="_id" tick={{ fontSize: 10, fill: T.muted }}
                          tickFormatter={v => v?.replace("_BOOK", "") ?? v} />
                        <YAxis tick={{ fontSize: 10, fill: T.muted }} />
                        <RTooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
                          {intents.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )
                }
              </Section>

              {/* Daily chart */}
              <Section title="Query Volume Over Time">
                {loadingMap.dailyUsage
                  ? <CircularProgress sx={{ color: T.gold }} />
                  : (
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={dailyUsage}>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                        <XAxis dataKey="_id" tick={{ fontSize: 10, fill: T.muted }} />
                        <YAxis tick={{ fontSize: 10, fill: T.muted }} />
                        <RTooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                        <Line type="monotone" dataKey="count" stroke={T.gold}
                          strokeWidth={2.5} dot={{ fill: T.gold, r: 3 }} name="Queries" />
                      </LineChart>
                    </ResponsiveContainer>
                  )
                }
              </Section>

              {/* Auth stats bar */}
              {authStats && (
                <Section title="Authentication Stats">
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={[
                      { name: "Total Logins",   value: authStats.totalLogins },
                      { name: "Failed Logins",  value: authStats.failedLogins },
                      { name: "Registrations",  value: authStats.registrations },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: T.muted }} />
                      <YAxis tick={{ fontSize: 11, fill: T.muted }} />
                      <RTooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        <Cell fill={T.gold} />
                        <Cell fill={T.error} />
                        <Cell fill={T.success} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Section>
              )}
            </Box>
          )}

          {/* ══ TAB 4: UPLOAD BOOKS ════════════════════════════════════════ */}
          {tab === 4 && (
            <Box maxWidth={700}>
              <Section title="Bulk Upload Books"
                action={
                  <Typography variant="caption" color={T.muted} fontSize="0.72rem">
                    Paste a JSON array of book objects
                  </Typography>
                }
              >
                <Typography variant="body2" color={T.muted} mb={2} fontSize="0.83rem">
                  Each book object should include: <code>title</code>, <code>main_author</code>,
                  <code>call_number</code>, <code>subjects</code> (array), and optionally
                  <code>publisher</code>, <code>year</code>, <code>notes</code>.
                </Typography>

                <Box sx={{
                  bgcolor: T.navy, borderRadius: 2, p: 1.5, mb: 2,
                  fontFamily: "monospace", fontSize: "0.72rem", color: T.gold,
                  lineHeight: 1.6,
                }}>
                  {`[
                      {
                        "title": "Introduction to Law",
                        "main_author": "Adamu, James",
                        "call_number": "K100 .A32 2020",
                        "subjects": ["Law", "Legal studies"],
                        "publisher": "UNIJOS Press",
                        "year": "2020"
                      }
                    ]`}
                </Box>

                <TextField
                  fullWidth multiline rows={10}
                  placeholder='[{"title": "...", "main_author": "...", "call_number": "...", "subjects": []}]'
                  value={uploadText}
                  onChange={e => setUploadText(e.target.value)}
                  sx={{
                    mb: 2,
                    "& .MuiOutlinedInput-root": {
                      fontFamily: "monospace", fontSize: "0.82rem",
                      "& fieldset":             { borderColor: T.border },
                      "&:hover fieldset":       { borderColor: T.gold },
                      "&.Mui-focused fieldset": { borderColor: T.gold },
                    },
                  }}
                />

                {uploadResult && (
                  <Alert severity={uploadResult.type} sx={{ mb: 2, borderRadius: 2 }}>
                    {uploadResult.text}
                  </Alert>
                )}

                <Button
                  variant="contained"
                  disabled={!uploadText.trim() || uploading}
                  onClick={handleUpload}
                  startIcon={uploading ? <CircularProgress size={16} sx={{ color: T.cream }} /> : <UploadFileIcon />}
                  sx={{
                    bgcolor: T.navy, color: T.cream,
                    fontFamily: "'Georgia', serif", fontWeight: 700,
                    textTransform: "none", borderRadius: 2, px: 3,
                    "&:hover": { bgcolor: T.navyLight },
                    "&.Mui-disabled": { bgcolor: T.creamDark, color: T.muted },
                  }}
                >
                  {uploading ? "Uploading…" : "Upload Books"}
                </Button>
              </Section>
            </Box>
          )}

        </Box>
      </Box>

      {/* ══ DELETE USER DIALOG ═══════════════════════════════════════════════ */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        PaperProps={{ sx: { borderRadius: 3, overflow: "hidden", minWidth: 320 } }}>
        <Box sx={{ height: 4, bgcolor: T.error }} />
        <DialogTitle sx={{ fontFamily: "'Georgia', serif", fontWeight: 700, color: T.navy, pt: 3 }}>
          Delete User
        </DialogTitle>
        <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        PaperProps={{ sx: { borderRadius: 3, overflow: "hidden", minWidth: 320 } }}>
        <Box sx={{ height: 4, bgcolor: T.error }} />
        <DialogTitle sx={{ fontFamily: "'Georgia', serif", fontWeight: 700, color: T.navy, pt: 3 }}>
          Delete User
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color={T.muted}>
            Are you sure you want to delete{" "}
            <Box component="span" fontWeight={700} color={T.navy}>
              {deleteTarget?.name}
            </Box>
            ? This action cannot be undone.
          </Typography>
          {deleteError && <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
            sx={{ color: T.muted, textTransform: "none", borderRadius: 2 }}>
            Cancel
          </Button>
          <Button onClick={confirmDelete} variant="contained" disabled={deleting}
            sx={{ bgcolor: T.error, color: T.white, textTransform: "none",
              borderRadius: 2, "&:hover": { bgcolor: "#a93226" } }}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
        </Dialog>
      </Dialog>
    </Box>
  );
}
