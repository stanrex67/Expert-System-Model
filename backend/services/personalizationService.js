// services/personalizationService.js
import Book from "../models/book.js";
import { findDepartment } from "../utils/academicCatalog.js";

export const escapeRegex = (s = "") => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const isProfileComplete = (p) =>
  !!(p?.department && p?.course && p?.level && p?.dateOfBirth && p?.stateOfOrigin);

const isPostgrad = (lvl = "") => /^(Postgraduate|Masters|PhD)/i.test(lvl);
const levelNum   = (lvl = "") => parseInt(lvl, 10) || 0;

// ── LC call-number matching ──────────────────────────────────────────────────
// Handles "QA76.73 .J38", "QA 76.73.S67", "Ref. RS75", "Ref:KP7096".
const lcCache = new Map();
export const lcRegex = (prefixes = []) => {
  if (!prefixes.length) return /$^/; // matches nothing
  const key = prefixes.join(",");
  if (!lcCache.has(key)) {
    const alts = prefixes.map((p) => escapeRegex(p).replace(/^([A-Z]+)(\d.*)$/, "$1\\s*$2")).join("|");
    // (?!ef[.:]) stops prefix "R" from matching the word "Ref."
    lcCache.set(key, new RegExp(`^\\s*(?:ref[.:]?\\s*)?(?:${alts})(?!ef[.:])`, "i"));
  }
  return lcCache.get(key);
};

// ── Topic extraction from past queries ───────────────────────────────────────
const LEAD = /^(?:please\s+|can you\s+|could you\s+)?(?:find|search(?:\s+for)?|show(?:\s+me)?|get(?:\s+me)?|i\s+(?:need|want)|any|list|recommend|suggest|look\s+for)\s+(?:some\s+|any\s+)?(?:good\s+)?(?:books?|textbooks?|materials?|resources?)?\s*(?:on|about|for|related\s+to|in)?\s*/i;

export const topicFromQuery = (q = "") => {
  const s = q.toLowerCase().trim();
  if (!/\b(find|search|books?|textbooks?|materials?|recommend|suggest|resources?|read)\b/.test(s)) return null;
  if (/^(where|how|what|when|who|is|are|can|do|does)\b/.test(s)) return null;
  const t = s.replace(LEAD, "").replace(/[?.!]+$/, "").trim();
  if (t.length < 3 || t.length > 40 || t.split(/\s+/).length > 4) return null;
  if (/^(books?|library|me|it|this|that)$/.test(t)) return null;
  return t;
};

// Recency-weighted: newer searches count more.
export const topTopics = (user, n = 3) => {
  const hist = (user?.search_history || []).slice(-30).reverse();
  const w = new Map();
  hist.forEach((item, i) => {
    const t = topicFromQuery(item.query);
    if (t) w.set(t, (w.get(t) || 0) + 1 / (1 + i * 0.15));
  });
  return [...w.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([t]) => t);
};

// ── Does the catalogue actually contain this topic? (cached) ─────────────────
const topicCache = new Map();
const TOPIC_TTL = 6 * 60 * 60 * 1000;
const topicHasBooks = async (topic) => {
  const c = topicCache.get(topic);
  if (c && Date.now() - c.at < TOPIC_TTL) return c.ok;
  const rx = new RegExp(`\\b${escapeRegex(topic)}`, "i");
  const ok = !!(await Book.exists({ $or: [{ title: rx }, { subjects: rx }] }));
  topicCache.set(topic, { ok, at: Date.now() });
  return ok;
};

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const rotate = (arr, by) => (arr.length ? arr.map((_, i) => arr[(i + by) % arr.length]) : []);

const DEFAULTS = [
  { label: "How do I borrow a book?",          query: "How do I borrow a book?" },
  { label: "Is the library open on Saturday?", query: "Is the library open on Saturday?" },
  { label: "What is the borrowing limit?",     query: "What is the borrowing limit?" },
  { label: "Where are law books?",             query: "Where are law books?" },
  { label: "Find books on engineering",        query: "Find books on engineering" },
  { label: "Find books on medicine",           query: "Find books on medicine" },
];

// ── Suggested queries for the new-chat screen ────────────────────────────────
export const getSuggestions = async (user, limit = 6) => {
  const out = [];
  const seen = new Set();
  const add = (label, query, source) => {
    const k = query.toLowerCase();
    if (seen.has(k) || out.length >= limit) return;
    seen.add(k);
    out.push({ label, query, source });
  };

  const p    = user?.profile || {};
  const dept = findDepartment(p.department);
  const day  = Math.floor(Date.now() / 86400000);

  // 1. What this user actually searches for (up to 2)
  for (const t of topTopics(user, 2)) {
    if (await topicHasBooks(t)) add(`More on ${t}`, `Find books on ${t}`, "history");
  }

  // 2. Their department (rotates daily so it doesn't feel static; only topics with real books)
  if (dept) {
    let added = 0;
    for (const topic of rotate(dept.topics, day % Math.max(1, dept.topics.length))) {
      if (added >= 3) break;
      if (await topicHasBooks(topic)) { add(`Books on ${topic}`, `Find books on ${topic}`, "department"); added++; }
    }
    if (dept.faculty !== "Other") add(`Where are ${dept.faculty} books?`, `Where are ${dept.faculty} books?`, "department");

    // 3. Level-aware
    if (isPostgrad(p.level) || levelNum(p.level) >= 400) {
      if (await topicHasBooks("research")) add("Research methodology books", "Find books on research methods", "level");
    } else if (levelNum(p.level) > 0 && levelNum(p.level) <= 200 && dept.faculty !== "Other") {
      add(`Introductory ${dept.name} textbooks`, `Find textbooks on ${dept.name}`, "level");
    }
  }

  // 4. Fill with sensible defaults
  DEFAULTS.forEach((x) => add(x.label, x.query, "default"));
  return out;
};

// ── Personalised "recommended for you" cards ─────────────────────────────────
export const dedupeBooks = (books = []) => {
  const norm = (s = "") => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const seen = new Set();
  return books.filter((b) => {
    const k = `${norm(b.title).slice(0, 70)}|${norm(b.call_number)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

// export const getRecommendations = async (user, limit = 5) => {
//   if (!user) return [];
//   const dept   = findDepartment(user.profile?.department);
//   const topics = topTopics(user, 3);
//   const or = [];
//   const trx = topics.map((t) => new RegExp(escapeRegex(t), "i"));
//   trx.forEach((rx) => or.push({ title: rx }, { subjects: rx }));
//   const lcr = dept && dept.lc.length ? lcRegex(dept.lc) : null;
//   if (lcr) or.push({ call_number: lcr });
//   if (!or.length) return [];

//   const pool = await Book.find({ $or: or }).limit(80).lean();
//   return dedupeBooks(pool)
//     .map((b) => {
//       let s = Math.random() * 0.5; // small jitter so the list isn't identical every time
//       trx.forEach((rx) => {
//         if ((b.subjects || []).some((x) => rx.test(x))) s += 3;
//         if (rx.test(b.title || "")) s += 2;
//       });
//       if (lcr?.test(b.call_number || "")) s += 1;
//       if (b.year >= 2010) s += 0.7;
//       return { b, s };
//     })
//     .sort((a, b) => b.s - a.s)
//     .slice(0, limit)
//     .map((x) => x.b);
// };

// ── Search helpers ───────────────────────────────────────────────────────────
// Notes are deliberately NOT scored: they hold accession numbers and cataloguer initials.

export const getRecommendations = async (user, limit = 5) => {
  if (!user) return [];
  const dept   = findDepartment(user.profile?.department);
  const lcr    = dept?.lc?.length ? lcRegex(dept.lc) : null;
  const topics = topTopics(user, 2);                       // was 3
  const trx    = topics.map((t) => new RegExp(escapeRegex(t), "i"));

  const [deptPool, topicPool] = await Promise.all([
    lcr ? Book.find({ call_number: lcr }).limit(150).lean() : [],
    trx.length
      ? Book.find({ $or: trx.flatMap((rx) => [{ title: rx }, { subjects: rx }]) }).limit(60).lean()
      : [],
  ]);

  const score = (b) => {
    let s = Math.random() * 0.5;                           // jitter so the list varies
    if (lcr?.test(b.call_number || "")) s += 4;            // department = main signal
    const hitsTopic = trx.some((rx) => (b.subjects || []).some((x) => rx.test(x)) || rx.test(b.title || ""));
    if (hitsTopic) s += 2;                                 // history = secondary
    if (b.year >= 2010) s += 0.7;
    return s;
  };

  return dedupeBooks([...deptPool, ...topicPool])
    .map((b) => ({ b, s: score(b) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.b);
};


export const keywordScore = (books, keywords) => {
  const rxs = keywords.map((w) => new RegExp(escapeRegex(w), "i"));
  const scored = books.map((book) => {
    let s = 0;
    rxs.forEach((rx) => {
      if (rx.test(book.title || ""))                    s += 6;
      if ((book.subjects || []).some((x) => rx.test(x))) s += 5;
      if (rx.test(book.main_author || ""))              s += 3;
    });
    return { book, s };
  }).filter((x) => x.s >= 3);
  const max = Math.max(1, ...scored.map((x) => x.s));
  return scored.sort((a, b) => b.s - a.s).map((x) => ({ ...x.book, _rel: x.s / max }));
};

// Semantic hits come from a pickle; swap them for the canonical Mongo record.
export const hydrateFromCatalogue = async (hits) => {
  const cns = hits.map((h) => h.call_number).filter(Boolean);
  if (!cns.length) return hits;
  const docs = await Book.find({ call_number: { $in: cns } }).lean();
  const map = new Map(docs.map((d) => [d.call_number, d]));
  return hits.map((h) => (map.has(h.call_number) ? { ...map.get(h.call_number), score: h.score } : h));
};

// Gentle nudge (+0.08) toward the user's department — never overrides a clear query.
export const rerankForUser = (books, user) => {
  const dept = findDepartment(user?.profile?.department);
  if (!dept || !dept.lc.length || !books.length) return books;
  const rx = lcRegex(dept.lc);
  return books
    .map((b, i) => ({ b, s: (b.score ?? b._rel ?? (0.5 - i * 0.001)) + (rx.test(b.call_number || "") ? 0.08 : 0) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.b);
};

// ── LLM context: department/level ONLY. Never send name, DOB or state to a third-party LLM.
export const buildUserContext = (user) => {
  const p = user?.profile;
  if (!p?.department) return "";
  const who = user.role === "staff" ? "Staff member" : user.role === "student" ? "Student" : "Library user";
  const lvl = p.level && !/not applicable/i.test(p.level) ? `, ${/^\d/.test(p.level) ? p.level + " level" : p.level}` : "";
  return `${who} in ${p.department}${lvl}${p.course ? ` (${p.course})` : ""}`;
};

export const isBirthdayToday = (dob) => {
  if (!dob) return false;
  const d = new Date(dob), n = new Date();
  return d.getUTCMonth() === n.getMonth() && d.getUTCDate() === n.getDate();
};
