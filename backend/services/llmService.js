// services/llmService.js
// Primary: Google Gemini
// Fallback: Groq (used when Gemini fails or is not configured)

import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

// Initialise providers only when their API keys are configured.
const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const GROQ_MODEL = "openai/gpt-oss-120b";

// ── System context injected into every prompt ────────────────────────────────
const LIBRARY_CONTEXT = `You are an AI-powered library reference assistant for the University of Jos (UNIJOS) library system in Nigeria.

Your role is to help students, staff, and researchers with:
- Finding books and academic resources
- Answering questions about library policies, rules, and services
- Explaining library procedures (borrowing, returning, renewing books)
- Guiding users to the correct campus library for their faculty
- Suggesting research strategies and alternative resources

## UNIJOS Library Key Facts
- Main campuses: Naraguta Campus, Bauchi Road Campus, JUTH Library, Faculty of Law Library
- Opening hours: Monday–Friday 8:00 AM – 4:00 PM; Saturdays vary by branch; closed Sundays and public holidays
- Borrowing limits: Undergraduates 2 books/2 weeks; Postgraduates 4 books/1 month; Staff 5 books/1 month
- Entry requires valid University ID or proof of registration
- Wi-Fi network: UNIJOS-Hotspot available within library premises
- Late returns attract fines (amount varies — direct users to the circulation desk for current rates)
- Past student projects/dissertations are for in-library use only

## Faculty → Library Location Map
- Law: Faculty of Law Library
- Natural Science, Health Science, Pharmaceutical Science, Dental Science: Bauchi Road Campus Library
- Medical Science: Bauchi Road Campus Library + JUTH Library
- Clinical Science: JUTH Library
- Education: Bauchi Road Campus + Naraguta Campus Library
- Art, Social Science, Environmental Science, Management Science, Agricultural Science, Veterinary Medicine, Engineering: Naraguta Campus Library

## Important — what NOT to duplicate
- Never invent or restate a book's call number — the app attaches real call numbers and shelf directions separately. If discussing a specific book found in the catalogue, refer to it by title/author only and let the app supply the call number.
- If told the search already found catalogue results, do not re-list every title — add context, connections between the works, or guidance on which one suits which need instead.
- If no catalogue results and no policy answer are available, keep your response general — the app will separately offer open-access resource links, so you don't need to invent specific external database names.

## Formatting Rules
- Do NOT use markdown formatting (no **bold**, no _italics_, no # headers).
- For emphasis, use quotation marks instead — e.g. "Naraguta Campus Library" not **Naraguta Campus Library**.
- Use plain bullet points (•) for lists, never asterisks or dashes as list markers.

## Response Style
- Be helpful, warm, and concise
- Use bullet points only for genuinely list-like content (e.g. steps, multiple distinct facts) — not for restating book titles already shown elsewhere
- Keep responses under 200 words
- Never fabricate book titles, authors, or call numbers
- If unsure about specifics, suggest the user ask at the circulation desk
- Talk like a knowledgeable, friendly librarian in a normal conversation. If a request is missing key details, ask one clear question instead of guessing.
- Do not push catalogue results, databases or links the user didn't ask for.
`;

// ── Groq fallback helper ────────────────────────────────────────────────────
const askGroq = async (fullPrompt) => {
  if (!groq) return null;

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: fullPrompt }],
      temperature: 0.5,
      max_completion_tokens: 1024,
      reasoning_effort: "low",
    });

    return completion.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error("Groq fallback error:", error.message);
    return null;
  }
};

const GEMINI_MODELS = (process.env.GEMINI_MODELS || "gemini-flash-latest,gemini-flash-lite-latest")
  .split(",").map(s => s.trim()).filter(Boolean);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const askGemini = async (prompt) => {
  if (!genAI) return null;
  for (const name of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const model = genAI.getGenerativeModel({ model: name });
        const result = await model.generateContent(prompt);
        const text = result.response.text()?.trim();
        if (text) return text;
      } catch (error) {
        const msg = error.message || "";
        console.error(`Gemini (${name}) error:`, msg.slice(0, 160));
        if (/API_KEY_INVALID/.test(msg)) return null;           // retrying won't help
        if (/503|429|overloaded|high demand|fetch failed/i.test(msg)) {
          await sleep(800 * (attempt + 1));                      // brief backoff, then retry
          continue;
        }
        break;                                                   // other error: try next model
      }
    }
  }
  return null;
};

/**
 * Makes an uncached LLM request.
 * Gemini is attempted first; Groq is used if Gemini fails or is unavailable.
 */
export const askLLMUncached = async (userQuery, context = {}, retries = 1) => {
  const {
    books = [],
    faqAnswer = null,
    locationResponse = null,
    intents = [],
    campusFaculties = [],
    userContext = "",
    mode = null,
    history = [],
  } = context;

  let contextBlock = "";

  if (userContext) {
    contextBlock += `\n\nAbout the user: ${userContext}. Use examples from their field when helpful, but never invent catalogue items.`;
  }

  if (history.length > 0) {
  contextBlock += `\n\nRecent conversation (oldest first):\n` +
    history.map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`).join("\n");
}

  if (campusFaculties.length > 0) {
    contextBlock += `\n\nThis campus library serves these faculties/subjects: ${campusFaculties.join(", ")}.`;
  }

  if (faqAnswer) {
    contextBlock += `\n\nRelevant library policy:\n${faqAnswer}`;
  }

  if (locationResponse) {
    contextBlock += `\n\nRelevant campus location:\n${locationResponse}`;
  }

  if (books.length > 0) {
    contextBlock += "\n\nBooks found in catalogue:\n";

    books.slice(0, 5).forEach((book, index) => {
      contextBlock += `${index + 1}. "${book.title}" by ${book.main_author || "Unknown"} — Call No: ${book.call_number ?? "N/A"}\n`;
    });
  }

  if (intents.length > 0) {
    contextBlock += `\n\nDetected intent: ${intents.join(", ")}`;
  }

  const fullPrompt = `${LIBRARY_CONTEXT}

${contextBlock ? `Context available:${contextBlock}\n\n` : ""}User question: "${userQuery}"

Please provide a helpful, accurate response. ${
    mode === "clarify_topic"
      ? "The user wants help finding books but has not said what subject. Reply warmly and naturally in 3-5 sentences: say you'd be glad to help, ask what topic or course the work is on, and if useful suggest ways to narrow it (field, region, time period). Tell them that once they name a topic you can search the catalogue. Do NOT list or invent any books, databases or links."
      : campusFaculties.length > 0
        ? "Explain that we don't list every title in a campus collection here, but describe the range of subjects that campus covers based on the faculties it serves, and invite the user to search by a specific subject instead."
        : books.length > 0
          ? "Reference the catalogue results where relevant."
          : "Use your knowledge of the UNIJOS library system to assist."
  }`;

  // ── Try Gemini first ──────────────────────────────────────────────────────
const geminiAnswer = await askGemini(fullPrompt);
if (geminiAnswer) return geminiAnswer;
console.warn("Gemini unavailable — falling back to Groq.");

  // ── Gemini unavailable/failed — try Groq ──────────────────────────────────
  const groqAnswer = await askGroq(fullPrompt);

  if (groqAnswer) return groqAnswer;

  return null;
};

// ── Module-level response cache ──────────────────────────────────────────────
const llmCache = new Map();

const LLM_TTL = 60 * 60 * 1000; // 1 hour
const LLM_MAX = 300;

// Public cached wrapper.
export const askLLM = async (userQuery, context = {}, retries = 1) => {
  const cacheable = !(context.books?.length) && !context.faqAnswer && !(context.history?.length);

  const normalizedQuery = userQuery.toLowerCase().replace(/\s+/g, " ").trim();

const key = [
  context.userContext || "",
  context.mode || "",
  (context.campusFaculties || []).join(","),
  context.locationResponse || "",
  normalizedQuery,
].join("|");

  if (cacheable) {
    const hit = llmCache.get(key);

    if (hit && Date.now() - hit.at < LLM_TTL) {
      return hit.text;
    }

    if (hit) {
      llmCache.delete(key);
    }
  }

  const answer = await askLLMUncached(userQuery, context, retries);

  if (cacheable && answer) {
    if (llmCache.size >= LLM_MAX) {
      llmCache.delete(llmCache.keys().next().value);
    }

    llmCache.set(key, {
      text: answer,
      at: Date.now(),
    });
  }

  return answer;
};

/**
 * Decide whether to invoke the LLM for this request.
 */
export const shouldUseLLM = ({
  books,
  faqAnswer,
  intents = [],
  query = "",
}) => {
  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
    return false;
  }

  const noBooksFound = !books || books.length === 0;
  const noFaqFound = !faqAnswer;

  const isGeneralHelp =
    intents.includes("GENERAL_HELP") || intents.length === 0;

  const isConversational =
    query.split(" ").length > 4 &&
    /\b(what|how|why|when|who|can|could|should|is|are|does|do|explain|tell me|difference|compare)\b/i.test(
      query
    );

  return (
    (noBooksFound && noFaqFound) ||
    isGeneralHelp ||
    isConversational
  );
};

/**
 * Summarize a large set of book search results.
 * Gemini is attempted first; Groq is the fallback.
 */
export const summarizeBookResults = async (userQuery, books) => {
  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
    return null;
  }

  const sample = books
    .slice(0, 15)
    .map(
      (book) =>
        `"${book.title}" (${(book.subjects || []).slice(0, 2).join(", ") || "General"})`
    )
    .join("; ");

  const prompt = `${LIBRARY_CONTEXT}

The user searched the catalogue for: "${userQuery}"
The search returned ${books.length} matching resources. A sample of them: ${sample}

Write a brief 2-3 sentence summary describing the range of material found (subfields, notable authors or editions, anything a student should know before scrolling through). Do not list titles individually — they're already shown to the user separately as cards. Keep it under 60 words.`;

const g = await askGemini(prompt);
if (g) return g;
return askGroq(prompt);

  return askGroq(prompt);
};