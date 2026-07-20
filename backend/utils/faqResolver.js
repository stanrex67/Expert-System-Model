import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const faqData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "libraryFAQ.json"), "utf-8")
);

const expertData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "expertKnowledge.json"), "utf-8")
);

// Words to ignore when keyword-matching the flat FAQ keys
const STOP_WORDS = new Set([
  "can", "is", "the", "a", "an", "what", "how", "where", "do",
  "i", "to", "be", "are", "my", "me", "in", "of", "it", "will",
  "does", "was", "has", "have", "had", "should", "would", "could",
  "please", "hi", "hey", "help"
]);

// ─── helpers ────────────────────────────────────────────────────────────────

/** Tokenise a string into meaningful words */
const tokenise = (str) =>
  str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

/**
 * Score how well a user query matches one question_pattern string.
 * Returns a number:
 *   20 → exact match
 *   10 → query contains the full pattern phrase
 *    2 → each shared meaningful word
 */
const scorePattern = (queryRaw, pattern) => {
  const q = queryRaw.toLowerCase().trim();
  const p = pattern.toLowerCase().trim();

  if (q === p) return 20;
  if (q.includes(p)) return 10;

  const qWords = new Set(tokenise(q));
  const pWords = tokenise(p);

  if (pWords.length === 0) return 0;

  let shared = 0;
  for (const w of pWords) {
    if (qWords.has(w)) shared++;
  }

  // Require at least 60 % of pattern words to match before giving any score
  const ratio = shared / pWords.length;
  return ratio >= 0.6 ? shared * 2 : 0;
};

// ─── main export ────────────────────────────────────────────────────────────

/**
 * Returns either:
 *   - a plain string  (from libraryFAQ.json)
 *   - an object { answer, tips }  (from expertKnowledge.json)
 *   - null  (no match found)
 */
export const findFAQResponse = (query) => {
  if (!query || !query.trim()) return null;

  const q = query.toLowerCase();

  // ── 1. Expert Knowledge (expertKnowledge.json) ───────────────────────────
  let bestExpert = null;
  let bestExpertScore = 0;

  for (const item of expertData) {
    // Skip entries with a truncated / placeholder answer
    if (!item.answer || item.answer.trim().endsWith("...")) continue;

    let itemScore = 0;

    for (const pattern of item.question_patterns || []) {
      const s = scorePattern(q, pattern);
      if (s > itemScore) itemScore = s;
    }

    // Weight by priority (default 1) but keep it mild so a 
    // strong pattern match always beats a weak high-priority one
    const weighted = itemScore * Math.log2((item.priority || 1) + 1);

    if (weighted > bestExpertScore) {
      bestExpertScore = weighted;
      bestExpert = item;
    }
  }

  // Threshold: pattern must score ≥ 8 (i.e. a real phrase/word match)
  if (bestExpertScore >= 8 && bestExpert) {
    return {
      answer: bestExpert.answer,
      tips: bestExpert.tips || []
    };
  }

  // ── 2. Flat FAQ (libraryFAQ.json) ────────────────────────────────────────
  // Keys are now full natural-language questions, so we score them the same way
  let bestFaqAnswer = null;
  let bestFaqScore = 0;

  for (const [key, answer] of Object.entries(faqData)) {
    const score = scorePattern(q, key);

    if (score > bestFaqScore) {
      bestFaqScore = score;
      bestFaqAnswer = answer;
    }
  }

  // Threshold: at least 2 meaningful shared words (score ≥ 4) 
  // OR a phrase match (score ≥ 10)
  if (bestFaqScore >= 4 && bestFaqAnswer) {
    return bestFaqAnswer; // plain string
  }

  return null;
};