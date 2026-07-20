/**
 * Rule-based intent classifier.
 * Returns an array of intent strings (can be multiple for hybrid queries).
 *
 * Intents: GREETING, SMALL_TALK, LIBRARY_INFO, FIND_BOOK,
 *          LOCATE_BOOK, RECOMMEND_BOOK, GENERAL_HELP
 */
export const detectIntent = (query) => {
  if (!query || !query.trim()) return ["GENERAL_HELP"];

  const q = query.toLowerCase().trim();
  const intents = new Set();

  // ── Normalise synonyms ────────────────────────────────────────────────────
  const n = q
    .replace(/\b(materials?|resources?|textbooks?)\b/g, "book")
    .replace(/\bsuggestions?\b/g, "recommend")
    .replace(/\bshow me\b/g, "find");

  // ── GREETING ─────────────────────────────────────────────────────────────
  if (/\b(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(q)) {
    intents.add("GREETING");
  }

  // ── SMALL TALK ────────────────────────────────────────────────────────────
  if (/\b(how are you|what can you do|who are you)\b/.test(q)) {
    intents.add("SMALL_TALK");
  }

  // ── LIBRARY INFO ──────────────────────────────────────────────────────────
  // Triggers on policy / facility questions regardless of other words in query
  if (
    /\b(hour|open|clos|time|borrow|return|renew|overdue|fine|wifi|internet|hotspot|rule|regulation|member|register|id card|entry|who can use|outsider|non.?student|fee|penalty|print|photocopy|dissertation|thesis|e.?book|journal|online resource)\b/.test(n)
  ) {
    intents.add("LIBRARY_INFO");
  }

  // ── RECOMMEND ─────────────────────────────────────────────────────────────
  if (/\b(recommend|suggest|best|top|good book)\b/.test(n)) {
    intents.add("RECOMMEND_BOOK");
  }

  // ── LOCATE ───────────────────────────────────────────────────────────────
  // "where are", "where is", "locate", "which shelf/section/floor", "location of"
  if (/\b(where (is|are|can)|locate|which shelf|which section|which floor|location of|guide me to)\b/.test(n)) {
    intents.add("LOCATE_BOOK");
  }

  // ── FIND BOOK ────────────────────────────────────────────────────────────
  // "find", "search", explicit "book", subject/author queries
  if (
    /\b(find|search|look for|book|author|subject|title|any books|i need|i want|show me|get me|list|what books|available)\b/.test(n)
  ) {
    intents.add("FIND_BOOK");
  }

  // ── FALLBACK ─────────────────────────────────────────────────────────────
  if (intents.size === 0) {
    // Very short queries are usually subject searches
    if (n.split(" ").length <= 3) {
      intents.add("FIND_BOOK");
    } else {
      intents.add("GENERAL_HELP");
    }
  }

  return Array.from(intents);
};