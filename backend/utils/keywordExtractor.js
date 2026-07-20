/**
 * Extract meaningful keywords from a user query for book search.
 *
 * We keep subject/topic words and remove only true filler words.
 * Important: we do NOT strip "where", "locate", "find" here —
 * those are handled by the intent classifier. This extractor
 * focuses on producing good MongoDB/semantic search terms.
 */

const STOP_WORDS = new Set([
  // articles & prepositions
  "a", "an", "the", "of", "on", "in", "at", "to", "for", "with",
  "by", "from", "up", "about", "into", "through", "during",
  // pronouns
  "i", "me", "my", "we", "our", "you", "your", "he", "she", "it",
  "they", "them", "their",
  // common verbs (too vague to search)
  "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can",
  // filler phrases
  "please", "any", "some", "show", "get", "need", "want",
  "give", "tell", "help", "let", "just",
  // common connector words
  "and", "or", "but", "if", "so", "yet", "nor",
  // library-specific filler (retained as intent signals, not search terms)
  "library", "book", "books", "material", "materials",
  "resource", "resources", "textbook", "textbooks", 

  // institutional/location names — not subject terms
  // "university", "jos", "unijos", "campus", "naraguta",
  // "bauchi", "road", "juth", "faculty",
]);

export const extractKeywords = (query) => {
  if (!query) return [];

  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w)); // was > 1 — 2-letter tokens carry ~no search signal
};

// utils/keywordExtractor.js — add this export
export const looksLikeGibberish = (word) => {
  if (word.length < 3) return true;  // now filtered out upstream anyway, but keep this honest
  if (!/[aeiou]/i.test(word) && word.length >= 4) return true;   // was > 4 — catch 4-letter no-vowel words too
  if (/[bcdfghjklmnpqrstvwxyz]{4,}/i.test(word)) return true;    // was 5+ — 4 consonants in a row is already rare in English
  return false;
};

