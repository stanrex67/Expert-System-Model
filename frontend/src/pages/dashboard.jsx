// src/pages/dashboard.jsx
// Full-viewport layout — sidebar + chat fill 100vw × 100vh
// No external Navbar. Mobile: sidebar becomes a slide-over drawer.

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Box, Typography, TextField, Paper, CircularProgress,
  IconButton, Chip, Avatar, List, ListItem, ListItemText,
  ListItemButton, Tooltip, Drawer, useMediaQuery, useTheme,
} from "@mui/material";
import { Button } from "@mui/material";
import SendIcon          from "@mui/icons-material/Send";
import DeleteIcon        from "@mui/icons-material/Delete";
import MenuBookIcon      from "@mui/icons-material/MenuBook";
import LogoutIcon        from "@mui/icons-material/Logout";
import AutoStoriesIcon   from "@mui/icons-material/AutoStories";
import ChevronLeftIcon   from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon  from "@mui/icons-material/ChevronRight";
import MenuIcon          from "@mui/icons-material/Menu";
import AddCommentIcon    from "@mui/icons-material/AddComment";
import ContentCopyIcon   from "@mui/icons-material/ContentCopy";
import ReplayIcon        from "@mui/icons-material/Replay";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { useNavigate }   from "react-router-dom";
import API      from "../api/authApi";
import BookCard from "../components/BookCard";
import DatabaseCard from "../components/DatabaseCard";
import CloseIcon from "@mui/icons-material/Close";  

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
};

const SIDEBAR_MIN     = 200;
const SIDEBAR_MAX     = 400;
const SIDEBAR_DEFAULT = 260;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const cleanText = (text = "") =>
  String(text ?? "")
    .replace(/\bundefined\b/g, "")
    .replace(/\bnull\b/g, "")
    .replace(/\uFFFD/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const getStoredUser = () => {
  try {
    const u = localStorage.getItem("user");
    return u ? JSON.parse(u) : { name: "Guest" };
  } catch { return { name: "Guest" }; }
};

const intentLabel = (raw = "") => {
  const map = {
    FIND_BOOK:      "📚 Book Search",
    LOCATE_BOOK:    "📍 Location",
    RECOMMEND_BOOK: "🎯 Recommendation",
    LIBRARY_INFO:   "ℹ️ Library Info",
    LOCATION_INFO:  "🏛️ Campus Location",
    GREETING:       "👋 Greeting",
    SMALL_TALK:     "💬 Help",
    GENERAL_HELP:   "💬 Help",
    DEFINITION:     "💭 Definition",
  };
  return raw.split(",").map(s => map[s.trim()] || s.trim()).join(" · ");
};

const formatTime = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d)) return "";
  const mins = Math.floor((Date.now() - d) / 60000);
  if (mins < 1)  return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return d.toLocaleDateString();
};

// ─── TypingText ───────────────────────────────────────────────────────────────
function TypingText({ text = "", isLatest }) {
  const safe = cleanText(text);
  const [displayed, setDisplayed] = useState(isLatest ? "" : safe);

  useEffect(() => {
    if (!isLatest) { setDisplayed(safe); return; }
    let i = 0;
    setDisplayed("");
    const iv = setInterval(() => {
      if (i >= safe.length) { clearInterval(iv); return; }
      setDisplayed(p => p + safe[i]);
      i++;
    }, 12);
    return () => clearInterval(iv);
  }, [safe, isLatest]);

  return (
  <Typography
    sx={{ whiteSpace: "pre-line", fontFamily: "'Georgia', serif", fontSize: "0.95rem", lineHeight: 1.75 }}>
    {displayed}
  </Typography>
);
}

// ─── HistoryItem ──────────────────────────────────────────────────────────────
// NOTE: now backed by a conversation summary — { id, title, updatedAt } —
// instead of a single flat query — { query, timestamp }.
function HistoryItem({ item, onSelect, onDelete, collapsed }) {
  return (
    <Tooltip title={collapsed ? item.title : ""} placement="right" arrow>
      <ListItem
        disablePadding
        secondaryAction={
          !collapsed && (
            <IconButton edge="end" size="small"
              onClick={e => { e.stopPropagation(); onDelete(item.id); }}
              sx={{ color: "rgba(255,255,255,0.6)", mr: -1,     // ← was 0.3
                "&:hover": { color: "#e74c3c", bgcolor: "rgba(231,76,60,0.1)" } }}>
              <DeleteIcon sx={{ fontSize: 13 }} />
            </IconButton>
          )
        }
      >
        <ListItemButton onClick={() => onSelect(item.id)} sx={{
          borderRadius: 1.5, py: 0.65,
          pr: collapsed ? 1 : 5, pl: 1.2,
          "&:hover": { bgcolor: "rgba(201,168,76,0.1)" },
        }}>
          {collapsed ? (
            <Box sx={{
              width: 26, height: 26, borderRadius: 1,
              bgcolor: "rgba(201,168,76,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: T.gold, fontWeight: 700, fontSize: "0.72rem",
              fontFamily: "'Georgia', serif",
            }}>
              {item.title?.[0]?.toUpperCase() || "?"}
            </Box>
          ) : (
            <ListItemText
              primary={item.title}
              secondary={formatTime(item.updatedAt)}
              slotProps={{
                primary: {
                  fontSize: "0.78rem", color: "rgba(248,244,236,0.92)",   // ← was 0.85
                  sx: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
                },
                secondary: { fontSize: "0.63rem", color: "rgba(255,255,255,0.55)" },  // ← was 0.3
              }}
            />
          )}
        </ListItemButton>
      </ListItem>
    </Tooltip>
  );
}

// ─── Sidebar content (shared between desktop & mobile drawer) ─────────────────
function SidebarContent({ collapsed, history, onSelect, onDelete, user, onLogout, onNewChat, onClose }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: T.navy }}>
      {/* Brand */}
      <Box sx={{
        p: collapsed ? 1.5 : 2,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}>
        <Box display="flex" alignItems="center" gap={1.2}
          justifyContent={collapsed ? "center" : "space-between"}>
          <Box display="flex" alignItems="center" gap={1.2}>
            <MenuBookIcon sx={{ color: T.gold, fontSize: 24, flexShrink: 0 }} />
            {!collapsed && (
              <Box minWidth={0}>
                <Typography variant="subtitle2" fontWeight={700} color={T.cream}
                  sx={{ fontFamily: "'Georgia', serif", lineHeight: 1.1, whiteSpace: "nowrap" }}>
                  UNIJOS Library
                </Typography>
                <Typography variant="caption" color={T.gold}
                  sx={{ letterSpacing: 1.4, fontSize: "0.58rem", whiteSpace: "nowrap" }}>
                  AI ASSISTANT
                </Typography>
              </Box>
            )}
          </Box>
          {/* Close button — only rendered when onClose is passed (mobile drawer) */}
          {onClose && !collapsed && (
            <IconButton size="small" onClick={onClose}
              sx={{ color: "rgba(255,255,255,0.7)", "&:hover": { color: T.gold } }}>
              <CloseIcon sx={{ fontSize: 20 }} />
            </IconButton>
          )}
        </Box>
        

        {/* New chat button */}
        {!collapsed && (
          <Box
            onClick={onNewChat}
            sx={{
              mt: 1.5, display: "flex", alignItems: "center", gap: 1,
              px: 1.5, py: 0.8,
              borderRadius: 1.5,
              border: "1px solid rgba(201,168,76,0.25)",
              cursor: "pointer",
              transition: "all 0.15s",
              "&:hover": { bgcolor: "rgba(201,168,76,0.1)", borderColor: T.gold },
            }}
          >
            <AddCommentIcon sx={{ fontSize: 15, color: T.gold }} />
            <Typography variant="caption" sx={{
              color: "rgba(248,244,236,0.7)", fontSize: "0.75rem",
              fontFamily: "'Georgia', serif",
            }}>
              New conversation
            </Typography>
          </Box>
        )}
      </Box>

      {/* History list */}
      <Box sx={{ flex: 1, overflowY: "auto", py: 1, px: collapsed ? 0.5 : 1,
        // Custom scrollbar
        "&::-webkit-scrollbar": { width: 4 },
        "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
        "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(255,255,255,0.1)", borderRadius: 2 },
      }}>
        {!collapsed && (
          <Typography variant="overline" sx={{
            color: "rgba(255,255,255,0.5)", fontSize: "0.58rem",   // ← was 0.25
            letterSpacing: 1.8, px: 1.2, display: "block", mb: 0.5,
          }}>
            Recent
          </Typography>
        )}

        {history.length === 0 && !collapsed && (
          <Typography variant="caption" sx={{
            color: "rgba(255,255,255,0.45)", px: 1.2, display: "block",   // ← was 0.25
            fontStyle: "italic", fontSize: "0.75rem",
          }}>
            Your conversations will appear here.
          </Typography>
        )}

        <List dense disablePadding>
          {history.map((item) => (
            <HistoryItem key={item.id} item={item}
              onSelect={onSelect} onDelete={onDelete} collapsed={collapsed}
            />
          ))}
        </List>
      </Box>

      {/* User footer */}
      <Box sx={{
        p: collapsed ? 1 : 1.5,
        borderTop: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
        display: "flex", alignItems: "center", gap: 1,
        justifyContent: collapsed ? "center" : "flex-start",
      }}>
        <Avatar sx={{
          bgcolor: T.gold, color: T.navy,
          width: 30, height: 30, flexShrink: 0,
          fontWeight: 700, fontSize: "0.8rem",
        }}>
          {user.name?.[0]?.toUpperCase() || "U"}
        </Avatar>
        {!collapsed && (
          <>
            <Box flex={1} minWidth={0}>
              <Typography variant="caption" fontWeight={600} color={T.cream}
                sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.name}
              </Typography>
              <Typography variant="caption" sx={{
                fontSize: "0.63rem", color: "rgba(255,255,255,0.55)",   // ← was 0.3
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block",
              }}>
                {user.email || "Student"}
              </Typography>
            </Box>
            <Tooltip title="Sign out">
              <IconButton size="small" onClick={onLogout}
                sx={{ color: "rgba(255,255,255,0.6)", flexShrink: 0,   // ← was 0.3
                  "&:hover": { color: "#e74c3c", bgcolor: "rgba(231,76,60,0.1)" } }}>
                <LogoutIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>
    </Box>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard({ resetRef }) {
  const navigate  = useNavigate();
  const theme     = useTheme();
  const isMobile  = useMediaQuery(theme.breakpoints.down("md")); // < 900px
  const [expandedBooks, setExpandedBooks] = useState({}); // { [messageIndex]: true }
  const [query,   setQuery]   = useState("");
  const [chat,    setChat]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Active conversation thread — null means "not yet started / new chat"
  const [conversationId, setConversationId] = useState(null);

  // Desktop sidebar state
  const [sidebarOpen,      setSidebarOpen]      = useState(true);
  const [sidebarWidth,     setSidebarWidth]     = useState(SIDEBAR_DEFAULT);
  const [widthBeforeClose, setWidthBeforeClose] = useState(SIDEBAR_DEFAULT);
  const [isResizing,       setIsResizing]       = useState(false);

  // Mobile drawer
  const [drawerOpen, setDrawerOpen] = useState(false);

  const startXRef  = useRef(0);
  const startWRef  = useRef(0);
  const chatEndRef = useRef(null);

  const messagesBoxRef = useRef(null);
const [showScrollButton, setShowScrollButton] = useState(false);



  const token    = localStorage.getItem("token");
  const user     = getStoredUser();
  const collapsed = !isMobile && sidebarOpen && sidebarWidth < 140;
  const effectiveWidth = (!isMobile && sidebarOpen) ? sidebarWidth : 0;

  // Register reset fn for Navbar "New Chat"
  useEffect(() => {
    if (resetRef) resetRef.current = () => { setChat([]); setQuery(""); setConversationId(null); };
  }, [resetRef]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, loading]);

  // Fetch conversation list (sidebar)
  const refreshConversations = useCallback(async () => {
    try {
      const res = await API.get("/auth/conversations");
      setHistory(res.data.data || []);
    } catch (err) {
      if (err?.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/");
      }
    }
  }, [navigate]);

  useEffect(() => {
    if (!token) return;
    refreshConversations();
  }, [token, refreshConversations]);

  // ── Desktop resize ───────────────────────────────────────────────────────
  const startResize = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWRef.current = sidebarWidth;
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e) => {
      const newW = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWRef.current + e.clientX - startXRef.current));
      setSidebarWidth(newW);
    };
    const onUp = () => setIsResizing(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",  onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [isResizing]);

  const toggleSidebar = () => {
    if (sidebarOpen) { setWidthBeforeClose(sidebarWidth); setSidebarOpen(false); }
    else { setSidebarWidth(widthBeforeClose || SIDEBAR_DEFAULT); setSidebarOpen(true); }
  };

  const handleMessagesScroll = () => {
  const el = messagesBoxRef.current;
  if (!el) return;
  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
  setShowScrollButton(distanceFromBottom > 150); // show once scrolled up a bit
};

const scrollToBottom = () => {
  chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
};

  // ── Chat handlers ────────────────────────────────────────────────────────
  const handleAsk = useCallback(async (input) => {
    if (input?.preventDefault) input.preventDefault();
    const queryText = typeof input === "string" ? input : query;
    const trimmed   = queryText.trim();

    if (!trimmed) {
      setChat(prev => [...prev, {
        type: "ai", intent: "", books: [], recommendations: [],
        text: "🤔 Please type a question.\n\nExamples:\n• Find books on engineering\n• Where are law books?\n• What time does the library open?",
      }]);
      return;
    }

    if (isMobile) setDrawerOpen(false); // close drawer on mobile after send
    setChat(prev => [...prev, { type: "user", text: trimmed }]);
    setQuery("");
    setLoading(true);

    try {
      const res    = await API.post("/ai/ask", { query: trimmed, conversationId });
      const aiData = res.data?.data || {};
      const safeAnswer = cleanText(aiData.answer ?? "");
      const books  = Array.isArray(aiData.books)           ? aiData.books           : [];
      const recs   = Array.isArray(aiData.recommendations) ? aiData.recommendations : [];
      const dbs    = Array.isArray(aiData.databases)       ? aiData.databases       : [];  
      const openAccessLinks = Array.isArray(aiData.openAccessLinks)
      ? aiData.openAccessLinks
      : [];
      const intent = Array.isArray(res.data?.intent)
        ? res.data.intent.join(", ") : (res.data?.intent || "");

      setChat(prev => [...prev, { type: "ai", text: safeAnswer, books, recommendations: recs, databases: dbs, openAccessLinks, intent }]);

      // Track which conversation thread this landed in (server creates one on first turn)
      if (res.data?.conversationId) setConversationId(res.data.conversationId);

      refreshConversations();
    } catch (err) {
      setChat(prev => [...prev, {
        type: "ai", intent: "", books: [], recommendations: [],
        text: cleanText(err?.response?.data?.message ?? "❌ Something went wrong. Please try again."),
        failed: true,
        retryQuery: trimmed,
      }]);
    } finally {
      setLoading(false);
    }
  }, [query, isMobile, conversationId, refreshConversations]);

  // Retry a failed query — re-sends the same input that failed
  const handleRetry = (retryQuery) => {
    if (!retryQuery) return;
    handleAsk(retryQuery);
  };

  // Copy an AI response to the clipboard
  const handleCopy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(key);
      setTimeout(() => setCopiedIndex(null), 1500);

    } catch {
      // clipboard permission denied or unsupported — non-critical
    }
  };

  const formatBooksForCopy = (books = []) =>
  books.map((b, i) =>
    `${i + 1}. ${b.title}${b.main_author ? ` — ${b.main_author}` : ""}${b.call_number ? ` (Call No: ${b.call_number})` : ""}`
  ).join("\n");

  // Remove a single message from the visible chat window.
  // NOTE: this only affects the current view — if this conversation was
  // already saved to the backend, reopening it from history will restore
  // the full saved thread including this message, since deletion isn't
  // persisted server-side.
const handleDeleteMessage = async (index) => {
  const msg = chat[index];
  const isUser = msg?.type === "user";
  const pairIndex = isUser ? index + 1 : index - 1;
  const hasPair = pairIndex >= 0 && pairIndex < chat.length &&
    chat[pairIndex]?.type === (isUser ? "ai" : "user");

  // Optimistically remove from the visible chat immediately
  setChat(prev => prev.filter((_, i) => i !== index && i !== (hasPair ? pairIndex : -1)));

  // Persist the deletion on the backend, if this turn was actually saved
  if (conversationId) {
    try {
      await API.delete(`/auth/conversations/${conversationId}/messages/${index}`);
    } catch (err) {
      // Non-critical for the UI, but the deletion won't survive a reopen if this fails
      console.error("Failed to delete message on server:", err);
    }
  }
};

  // Load a full past conversation into the chat window
  const handleSelectConversation = async (id) => {
    try {
      const res   = await API.get(`/auth/conversations/${id}`);
      const convo = res.data?.data;
      if (!convo) return;

      setConversationId(convo._id ?? convo.id ?? id);
      setChat(
      (convo.messages || []).map((m) => ({
        type: m.sender === "user" ? "user" : "ai",
        text: cleanText(m.text ?? ""),
        intent: Array.isArray(m.intent) ? m.intent.join(", ") : (m.intent || ""),
        books: Array.isArray(m.books) ? m.books : [],
        recommendations: Array.isArray(m.recommendations) ? m.recommendations : [],
        databases: Array.isArray(m.databases) ? m.databases : [],   // ← NEW
        openAccessLinks: Array.isArray(m.openAccessLinks) ? m.openAccessLinks : [],
      }))
    );

      if (isMobile) setDrawerOpen(false);
    } catch (err) {
      if (err?.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/");
      }
    }
  };

  const handleDeleteHistory = async (id) => {
    try { await API.delete(`/auth/conversations/${id}`); } catch { /* non-critical */ }
    setHistory(prev => prev.filter(item => item.id !== id));
    // If the conversation being viewed was deleted, clear the chat window
    if (conversationId === id) {
      setChat([]);
      setConversationId(null);
    }
  };

  const handleNewChat = () => { setChat([]); setQuery(""); setConversationId(null); };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  // ── Unauthenticated landing ───────────────────────────────────────────────
  if (!token) {
    return (
      <Box sx={{
        height: "100vh", wwidth: "100%", maxWidth: "100%",
        overflow: "hidden",
        position: "fixed",
        inset: 0,
        bgcolor: T.navy,
        backgroundImage: `radial-gradient(ellipse at 60% 20%, ${T.navyMid} 0%, ${T.navy} 65%)`,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        textAlign: "center", px: 3, overflow: "hidden",
      }}>
        <AutoStoriesIcon sx={{ fontSize: { xs: 48, md: 64 }, color: T.gold, mb: 2 }} />
        <Typography variant="h3" fontWeight={700} color={T.cream}
          sx={{ fontFamily: "'Georgia', serif", letterSpacing: "-0.5px",
            fontSize: { xs: "1.8rem", sm: "2.4rem", md: "3rem" } }}>
          University of Jos
        </Typography>
        <Typography variant="h5" color={T.gold} mb={1}
          sx={{ fontFamily: "'Georgia', serif", fontSize: { xs: "1rem", md: "1.5rem" } }}>
          Library Expert System Model
        </Typography>
        <Typography color={T.muted} mb={5} maxWidth={420} sx={{ fontSize: { xs: "0.85rem", md: "0.95rem" } }}>
          An AI-powered reference service — find books, locate resources, and navigate the library with ease.
        </Typography>
       <Box
  display="flex"
  gap={2}
  flexWrap="wrap"
  justifyContent="center"
  alignItems="center"
  sx={{
    mt: 2,
  }}
>
  <Button
    variant="contained"
    onClick={() => navigate("/login")}
    sx={{
      bgcolor: T.gold,
      color: T.navy,
      fontWeight: 700,
      px: { xs: 3, md: 4 },
      py: 1.2,
      borderRadius: 2,
      fontFamily: "'Georgia', serif",
      minWidth: 140,
      "&:hover": {
        bgcolor: T.goldLight,
      },
    }}
  >
    Sign In
  </Button>

  <Button
    variant="outlined"
    onClick={() => navigate("/register")}
    sx={{
      borderColor: "rgba(248,244,236,0.4)",
      color: T.cream,
      px: { xs: 3, md: 4 },
      py: 1.2,
      borderRadius: 2,
      fontFamily: "'Georgia', serif",
      minWidth: 140,
      ml: 1, // 🔥 adds visible separation
      "&:hover": {
        borderColor: T.gold,
        color: T.gold,
      },
    }}
  >
    Register
  </Button>
</Box>
      </Box>
    );
  }

  // ── Common sidebar props ──────────────────────────────────────────────────
  const sidebarProps = {
    history, user,
    collapsed,
    onSelect: handleSelectConversation,
    onDelete: handleDeleteHistory,
    onLogout: handleLogout,
    onNewChat: handleNewChat,
  };

  // ── Main layout ───────────────────────────────────────────────────────────
  return (
    <Box sx={{
      display: "flex",
      width: "100%",
      height: "100dvh",
      maxWidth: "100%",
      overflow: "hidden",
      position: "fixed",
      inset: 0,
      bgcolor: T.cream,
      userSelect: isResizing ? "none" : "auto",
      cursor:     isResizing ? "col-resize" : "auto",
    }}>

      {/* ══ MOBILE DRAWER ════════════════════════════════════════════════════ */}
     {isMobile && (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          ModalProps={{ keepMounted: true }}
          PaperProps={{ sx: { width: 280, bgcolor: T.navy, border: "none" } }}
          slotProps={{
            backdrop: { sx: { backgroundColor: "rgba(11,31,58,0.45)" } }  // ← lighter, chat visible through it
          }}
        >
          <SidebarContent {...sidebarProps} collapsed={false} onClose={() => setDrawerOpen(false)} />
        </Drawer>
      )}

      {/* ══ DESKTOP SIDEBAR ══════════════════════════════════════════════════ */}
      {!isMobile && (
        <>
          <Box sx={{
            width: effectiveWidth, minWidth: 0, flexShrink: 0,
            overflow: "hidden",
            transition: isResizing ? "none" : "width 0.22s cubic-bezier(0.4,0,0.2,1)",
          }}>
            {sidebarOpen && <SidebarContent {...sidebarProps} />}
          </Box>

          {/* Resize handle */}
          {sidebarOpen && (
            <Box onMouseDown={startResize} sx={{
              width: 4, flexShrink: 0,
              cursor: "col-resize", zIndex: 10, position: "relative",
              bgcolor: isResizing ? T.gold : "transparent",
              transition: "background-color 0.15s",
              "&:hover": { bgcolor: T.gold },
              "&::after": { content: '""', position: "absolute", inset: "0 -6px" },
            }} />
          )}

          {/* Toggle tab */}
          <Box sx={{
            position: "absolute",
            left: effectiveWidth + (sidebarOpen ? 4 : 0),
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 40,
            transition: isResizing ? "none" : "left 0.22s cubic-bezier(0.4,0,0.2,1)",
          }}>
           <Tooltip title={sidebarOpen ? "Collapse" : "Expand"} placement="right">
              <IconButton onClick={toggleSidebar} size="small" sx={{
                bgcolor: T.gold, color: T.navy,          // ← inverted: gold bg, navy icon — stronger contrast than gold-on-navy
                width: 22, height: 46,                   // ← slightly larger
                borderRadius: "0 6px 6px 0",
                boxShadow: "2px 0 12px rgba(0,0,0,0.35)", // ← stronger shadow
                "&:hover": { bgcolor: T.goldLight },
                "& svg": { fontSize: 16 },               // ← was 14
              }}>
                {sidebarOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
              </IconButton>
            </Tooltip>
          </Box>
        </>
      )}

      {/* ══ MAIN CHAT AREA ═══════════════════════════════════════════════════ */}
     <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden", position: "relative" }}>

        {/* ── Chat header ── */}
        <Box sx={{
          px: { xs: 1.5, md: 3 }, py: 1.2,
          bgcolor: T.white,
          borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", gap: 1.5,
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          flexShrink: 0,
          minHeight: 52,
        }}>
          {/* Hamburger on mobile */}
          {isMobile && (
            <IconButton size="small" onClick={() => setDrawerOpen(true)}
              sx={{ color: T.navy, mr: 0.5 }}>
              <MenuIcon />
            </IconButton>
          )}

          <AutoStoriesIcon sx={{ color: T.gold, fontSize: 20, flexShrink: 0 }} />
          <Typography fontWeight={600} color={T.navy}
            sx={{ fontFamily: "'Georgia', serif", fontSize: { xs: "0.88rem", md: "1rem" }, flex: 1, minWidth: 0 }}>
            University of Jos Library Expert System Model
          </Typography>

          {/* Online chip */}
          <Chip label="Online" size="small" sx={{
            bgcolor: "#e6f4ec", color: T.success,
            fontWeight: 600, fontSize: "0.65rem", height: 20,
            display: { xs: "none", sm: "flex" },
          }} />

          {/* Mobile new chat */}
          {isMobile && (
            <Tooltip title="New chat">
              <IconButton size="small" onClick={handleNewChat}
                sx={{ color: T.navy, "&:hover": { color: T.gold } }}>
                <AddCommentIcon sx={{ fontSize: 19 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* ── Messages ── */}
        <Box 
         ref={messagesBoxRef}
         onScroll={handleMessagesScroll}
        sx={{
          flex: 1, overflowY: "auto", overflowX: "hidden",
          p: { xs: 1.5, md: 3 },
          display: "flex", flexDirection: "column", gap: 2,
          // Custom scrollbar
          "&::-webkit-scrollbar": { width: 5 },
          "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
          "&::-webkit-scrollbar-thumb": { bgcolor: T.border, borderRadius: 3 },
        }}>

          {/* Welcome screen */}
          {chat.length === 0 && (
            <Box sx={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              textAlign: "center",
              py: { xs: 4, md: 6 },
              px: { xs: 1, md: 0 },
            }}>
              <AutoStoriesIcon sx={{ fontSize: { xs: 40, md: 52 }, color: T.gold, mb: 2, opacity: 0.75 }} />
              <Typography fontWeight={700} color={T.navy}
                sx={{ fontFamily: "'Georgia', serif", mb: 0.5,
                  fontSize: { xs: "1.2rem", md: "1.5rem" } }}>
                Welcome back, {user.name}
              </Typography>
              <Typography color={T.muted} mt={0.5} mb={4}
                sx={{ maxWidth: 380, fontSize: { xs: "0.82rem", md: "0.9rem" } }}>
                Ask me to find books, locate resources, or answer any library question.
              </Typography>

              {/* Suggestion chips */}
             
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "1fr 1fr",
                  },
                  gap: 2,
                  mt: 4,
                  width: "100%",
                  maxWidth: 700,
                }}
              >
                {[
                  { label: "Find books on engineering" },
                  { label: "Where are law books?" },
                  { label: "How do I borrow a book?" },
                  { label: "Is the library open on Saturday?" },
                  { label: "Find books on medicine" },
                  { label: "What is the borrowing limit?" },
                  { label: "🏛️ UNIJOS Institutional Repository", link: "https://irespos.unijos.edu.ng" },  // ← NEW
                ].map(({ label, link }) => (
                  <Chip
                    key={label}
                    label={label}
                    clickable
                    onClick={() => {
                      if (link) {
                        window.open(link, "_blank", "noopener,noreferrer");
                      } else {
                        handleAsk(label);
                      }
                    }}
                    sx={{
                      width: "100%",
                      height: 44,
                      fontSize: "0.9rem",
                      "&:hover": { bgcolor: T.gold, color: T.navy },
                      transition: "all 0.15s",
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Chat messages */}
          {chat.map((msg, index) => (
            <Box key={index}>

              {/* User bubble */}
              {msg.type === "user" && (
                <Box display="flex" flexDirection="column" alignItems="flex-end">
                  <Paper elevation={0} sx={{
                    px: { xs: 1.8, md: 2.5 }, py: { xs: 1.2, md: 1.5 },
                    bgcolor: T.navy, color: T.white,
                    borderRadius: "18px 18px 4px 18px",
                    maxWidth: { xs: "88%", md: "70%" },
                    boxShadow: "0 2px 8px rgba(11,31,58,0.16)",
                  }}>
                    <Typography sx={{ fontSize: { xs: "0.88rem", md: "0.92rem" }, lineHeight: 1.6 }}>
                      {msg.text}
                    </Typography>
                  </Paper>
                  <Tooltip title="Delete message">
                    <IconButton size="small" onClick={() => handleDeleteMessage(index)}
                      sx={{ color: T.muted, p: 0.3, mt: 0.2,
                        "&:hover": { color: "#e74c3c" } }}>
                      <DeleteIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}

              {/* AI bubble */}
              {msg.type === "ai" && (
                <Box display="flex" flexDirection="column" alignItems="flex-start" gap={1}>

                  {msg.intent && (
                    <Chip label={intentLabel(msg.intent)} size="small" sx={{
                      bgcolor: T.creamDark, color: T.navy, fontWeight: 600,
                      fontSize: "0.65rem", border: `1px solid ${T.border}`, height: 20,
                    }} />
                  )}

                  {msg.text && (
                    <Paper elevation={0} sx={{
                      px: { xs: 1.8, md: 2.5 }, py: { xs: 1.4, md: 1.8 },
                      bgcolor: T.white,
                      borderRadius: "4px 18px 18px 18px",
                      maxWidth: { xs: "92%", md: "78%" },
                      border: `1px solid ${T.border}`,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                    }}>
                      <TypingText text={msg.text} isLatest={index === chat.length - 1} />

                      <Box display="flex" justifyContent="flex-end" alignItems="center" gap={0.5} mt={0.5}>
                        {msg.failed && (
                          <Tooltip title="Retry">
                            <IconButton size="small" onClick={() => handleRetry(msg.retryQuery)}
                              sx={{ color: T.muted, p: 0.4, "&:hover": { color: T.gold } }}>
                              <ReplayIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title={copiedIndex === index ? "Copied!" : "Copy"}>
                          <IconButton size="small" onClick={() => handleCopy(msg.text, index)}
                            sx={{ color: T.muted, p: 0.4, "&:hover": { color: T.gold } }}>
                            <ContentCopyIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete message">
                          <IconButton size="small" onClick={() => handleDeleteMessage(index)}
                            sx={{ color: T.muted, p: 0.4, "&:hover": { color: "#e74c3c" } }}>
                            <DeleteIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Paper>
                  )}

                  {msg.books?.length > 0 && (
                     <Box width="100%" sx={{ maxWidth: { xs: "100%", md: "78%" } }}>
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Typography variant="overline"
                          sx={{ color: T.muted, fontSize: "0.6rem", letterSpacing: 1.5 }}>
                          📚 Results {msg.books.length > 1 ? `(${msg.books.length})` : ""}
                        </Typography>
                        <Tooltip title={copiedIndex === `books-${index}` ? "Copied!" : "Copy list"}>
                          <IconButton size="small"
                            onClick={() => handleCopy(formatBooksForCopy(msg.books), `books-${index}`)}
                            sx={{ color: T.muted, p: 0.3 }}>
                            <ContentCopyIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      <Box display="flex" flexDirection="column" gap={1} mt={0.5}>
                        {(expandedBooks[index] ? msg.books : msg.books.slice(0, 10))
                          .map((book, i) => <BookCard key={i} book={book} />)}
                      </Box>

                      {msg.books.length >= 5 && !expandedBooks[index] && (
                        <Box textAlign="center" mt={1}>
                          <Chip
                            label={`View ${msg.books.length - 10} more`}
                            clickable
                            onClick={() => setExpandedBooks(prev => ({ ...prev, [index]: true }))}
                            sx={{
                              bgcolor: T.creamDark, color: T.navy,
                              border: `1px solid ${T.border}`,
                              fontFamily: "'Georgia', serif", fontSize: "0.78rem",
                              "&:hover": { bgcolor: T.gold },
                            }}
                          />
                        </Box>
                      )}
                    </Box>
                  )}

                  {msg.recommendations?.length > 0 && (
                    <Box width="100%" sx={{ maxWidth: { xs: "100%", md: "78%" } }}>
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Typography variant="overline"
                          sx={{ color: T.muted, fontSize: "0.6rem", letterSpacing: 1.5 }}>
                          🎯 Recommended for you
                        </Typography>
                        <Tooltip title={copiedIndex === `recs-${index}` ? "Copied!" : "Copy list"}>
                          <IconButton size="small"
                            onClick={() => handleCopy(formatBooksForCopy(msg.recommendations), `recs-${index}`)}
                            sx={{ color: T.muted, p: 0.3 }}>
                            <ContentCopyIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      <Box display="flex" flexDirection="column" gap={1} mt={0.5}>
                        {msg.recommendations.map((book, i) => <BookCard key={i} book={book} />)}
                      </Box>
                    </Box>
                  )}

                  {msg.databases?.length > 0 && (
                  <Box width="100%" sx={{ maxWidth: { xs: "100%", md: "78%" } }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Typography variant="overline"
                        sx={{ color: T.muted, fontSize: "0.6rem", letterSpacing: 1.5 }}>
                        🌐 Recommended Databases
                      </Typography>
                      <Tooltip title={copiedIndex === `dbs-${index}` ? "Copied!" : "Copy list"}>
                        <IconButton size="small"
                          onClick={() => handleCopy(
                            msg.databases.map((d, i) => `${i + 1}. ${d.name}${d.accessNote ? ` — ${d.accessNote}` : ""} (${d.url})`).join("\n"),
                            `dbs-${index}`
                          )}
                          sx={{ color: T.muted, p: 0.3 }}>
                          <ContentCopyIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Box display="flex" flexDirection="column" gap={1} mt={0.5}>
                      {msg.databases.map((db, i) => <DatabaseCard key={i} database={db} />)}
                    </Box>
                  </Box>
                )}

                  {msg.openAccessLinks?.length > 0 && (
                    <Box
                      width="100%"
                      sx={{ maxWidth: { xs: "100%", md: "78%" } }}
                    >
                      <Typography
                        variant="overline"
                        sx={{
                          color: T.muted,
                          fontSize: "0.6rem",
                          letterSpacing: 1.5,
                        }}
                      >
                        🌐 Open Access Resources
                      </Typography>

                      <Paper
                        elevation={0}
                        sx={{
                          mt: 1,
                          p: 2,
                          bgcolor: T.white,
                          border: `1px solid ${T.border}`,
                          borderRadius: 3,
                        }}
                      >
                        {msg.openAccessLinks.map((link, i) => (
                          <Box key={i} mb={1.5}>
                            <Typography
                              component="a"
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{
                                color: T.navy,
                                fontWeight: 600,
                                textDecoration: "none",
                                "&:hover": {
                                  color: T.gold,
                                  textDecoration: "underline",
                                },
                              }}
                            >
                              {link.title}
                            </Typography>

                            <Typography
                              variant="caption"
                              display="block"
                              sx={{ color: T.muted }}
                            >
                              {link.url}
                            </Typography>
                          </Box>
                        ))}
                      </Paper>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          ))}

          {/* Thinking */}
          {loading && (
            <Box display="flex" alignItems="center">
              <Paper elevation={0} sx={{
                px: 2.5, py: 1.4, bgcolor: T.white,
                border: `1px solid ${T.border}`,
                borderRadius: "4px 18px 18px 18px",
                display: "flex", alignItems: "center", gap: 1.2,
              }}>
                <CircularProgress size={12} thickness={5} sx={{ color: T.gold }} />
                <Typography sx={{ fontSize: "0.86rem", color: T.muted, fontFamily: "'Georgia', serif" }}>
                  Searching the library…
                </Typography>
              </Paper>
            </Box>
          )}

          <div ref={chatEndRef} />
        </Box>

         {/* ── Scroll-to-bottom button — NEW, sibling of the Messages Box above ── */}
          {showScrollButton && (
            <IconButton
              onClick={scrollToBottom}
              sx={{
                
                position: "absolute",
                bottom: { xs: 90, md: 100 },
                right: { xs: 20, md: 40 },
                bgcolor: T.navy, color: T.gold,
                width: 38, height: 38,
                boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
                "&:hover": { bgcolor: T.navyLight },
                zIndex: 20,
              }}
            >
              <KeyboardArrowDownIcon />
            </IconButton>
          )}

        {/* ── Input bar ── */}
        <Box sx={{
          px: { xs: 1.5, md: 3 }, py: { xs: 1.5, md: 2 },
          bgcolor: T.white,
          borderTop: `1px solid ${T.border}`,
          boxShadow: "0 -2px 8px rgba(0,0,0,0.04)",
          flexShrink: 0,
        }}>
          <Box component="form" onSubmit={handleAsk} display="flex" gap={1} alignItems="center">
            <TextField fullWidth
              placeholder="Ask me anything about the library…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); }
              }}
              variant="outlined" size="small"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 3, bgcolor: T.cream,
                  fontFamily: "'Georgia', serif",
                  fontSize: { xs: "0.88rem", md: "0.92rem" },
                  "& fieldset":             { borderColor: T.border },
                  "&:hover fieldset":       { borderColor: T.gold },
                  "&.Mui-focused fieldset": { borderColor: T.gold, borderWidth: 2 },
                },
              }}
            />
            <IconButton type="submit" disabled={!query.trim() || loading} sx={{
              bgcolor: T.navy, color: T.white,
              width: { xs: 38, md: 42 }, height: { xs: 38, md: 42 },
              borderRadius: 2, flexShrink: 0,
              "&:hover": { bgcolor: T.navyLight },
              "&.Mui-disabled": { bgcolor: T.creamDark, color: T.muted },
              transition: "all 0.18s",
            }}>
              <SendIcon sx={{ fontSize: { xs: 17, md: 19 } }} />
            </IconButton>
          </Box>

          <Typography variant="caption" color={T.muted}
            sx={{ mt: 0.8, display: "block", textAlign: "center", fontSize: "0.65rem" }}>
            University of Jos Library Intelligence System · AI-powered
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}



