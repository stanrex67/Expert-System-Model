// services/llmService.js
// Primary: Google Gemini (FREE — no credit card needed)
//   Get your key at: aistudio.google.com → "Get API Key"
//   Set in .env:  GEMINI_API_KEY=AIza...
// Fallback: Groq (FREE — no credit card needed, used only if Gemini fails)
//   Get your key at: console.groq.com → "API Keys"
//   Set in .env:  GROQ_API_KEY=gsk_...

import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const groq  = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

const GROQ_MODEL = "llama-3.3-70b-versatile";

// ── System context injected into every prompt ─────────────────────────────────
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
- If unsure about specifics, suggest the user ask at the circulation desk`;

// ── Groq fallback helper ───────────────────────────────────────────────────
// Used only when Gemini fails (503, fetch failed, rate limit, etc).
// Takes a fully-built prompt string so both askLLM and summarizeBookResults
// can reuse it without duplicating prompt-construction logic.
const askGroq = async (fullPrompt) => {
  if (!groq) return null; // no GROQ_API_KEY set — fallback silently disabled

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: fullPrompt }],
      temperature: 0.5,
      max_tokens: 400,
    });

    return completion.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error("Groq fallback error:", error.message);
    return null;
  }
};

/**
 * Ask Gemini a question with optional library context.
 * Falls back to Groq automatically if Gemini fails for any reason.
 *
 * @param {string} userQuery
 * @param {object} context  - { books, faqAnswer, locationResponse, intents, campusFaculties }
 * @returns {Promise<string|null>}
 */
export const askLLM = async (userQuery, context = {}, retries = 1) => {
  const { books = [], faqAnswer = null, locationResponse = null, intents = [], campusFaculties = [] } = context;

  // Build context block (shared by both Gemini and the Groq fallback)
  let contextBlock = "";

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
    contextBlock += `\n\nBooks found in catalogue:\n`;
    books.slice(0, 5).forEach((b, i) => {
      contextBlock += `${i + 1}. "${b.title}" by ${b.main_author || "Unknown"} — Call No: ${b.call_number ?? "N/A"}\n`;
    });
  }
  if (intents.length > 0) {
    contextBlock += `\n\nDetected intent: ${intents.join(", ")}`;
  }

  const fullPrompt = `${LIBRARY_CONTEXT}

${contextBlock ? `Context available:${contextBlock}\n\n` : ""}User question: "${userQuery}"

Please provide a helpful, accurate response. ${
    campusFaculties.length > 0
      ? "Explain that we don't list every title in a campus collection here, but describe the range of subjects that campus covers based on the faculties it serves, and invite the user to search by a specific subject instead."
      : books.length > 0 ? "Reference the catalogue results where relevant." : "Use your knowledge of the UNIJOS library system to assist."
  }`;

  // ── Try Gemini first ─────────────────────────────────────────────────────
  if (process.env.GEMINI_API_KEY) {
    try {
      const model    = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
      const result   = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text     = response.text()?.trim();

      if (text) return text;
      // Gemini returned an empty response — fall through to Groq below

    } catch (error) {
      console.error("Gemini LLM Error:", error.message);

      // Transient network failure — worth one retry before falling back
      if (retries > 0 && /fetch failed/i.test(error.message)) {
        console.warn("Retrying Gemini request after fetch failure...");
        return askLLM(userQuery, context, retries - 1);
      }

      if (error.message?.includes("API_KEY_INVALID")) {
        console.error("❌ Invalid Gemini API key — check GEMINI_API_KEY in .env");
      }
      if (error.message?.includes("RATE_LIMIT") || error.message?.includes("503")) {
        console.warn("⚠️ Gemini unavailable — falling back to Groq");
      }
      // fall through to Groq below regardless of error type
    }
  }

  // ── Gemini failed or is not configured — try Groq ───────────────────────
  const groqAnswer = await askGroq(fullPrompt);
  if (groqAnswer) return groqAnswer;

  return null; // both providers failed (or neither is configured) — caller uses its own fallback
};

/**
 * Decide whether to invoke the LLM for this request.
 * LLM is called when results are weak or query is complex.
 * Returns false only if NEITHER provider has a key configured.
 */
export const shouldUseLLM = ({ books, faqAnswer, intents, query }) => {
  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) return false;

  const noBooksFound    = !books || books.length === 0;
  const noFaqFound      = !faqAnswer;
  const isGeneralHelp   = intents.includes("GENERAL_HELP") || intents.length === 0;
  const isConversational = query.split(" ").length > 4 &&
    /\b(what|how|why|when|who|can|could|should|is|are|does|do|explain|tell me|difference|compare)\b/i.test(query);

  return (noBooksFound && noFaqFound) || isGeneralHelp || isConversational;
};

/**
 * Summarize a large set of book search results (only called when >=5 matches),
 * so the user gets a quick sense of what's there without re-listing every title.
 * Falls back to Groq automatically if Gemini fails.
 */
export const summarizeBookResults = async (userQuery, books) => {
  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) return null;

  const sample = books.slice(0, 15)
    .map(b => `"${b.title}" (${(b.subjects || []).slice(0, 2).join(", ") || "General"})`)
    .join("; ");

  const prompt = `${LIBRARY_CONTEXT}

The user searched the catalogue for: "${userQuery}"
The search returned ${books.length} matching resources. A sample of them: ${sample}

Write a brief 2-3 sentence summary describing the range of material found (subfields, notable authors or editions, anything a student should know before scrolling through). Do not list titles individually — they're already shown to the user separately as cards. Keep it under 60 words.`;

  if (process.env.GEMINI_API_KEY) {
    try {
      const model    = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
      const result   = await model.generateContent(prompt);
      const response = await result.response;
      const text     = response.text()?.trim();
      if (text) return text;
    } catch (error) {
      console.error("Gemini summarizeBookResults error:", error.message);
      // fall through to Groq below
    }
  }

  return await askGroq(prompt);
};

// // services/llmService.js
// // Uses Google Gemini (FREE — no credit card needed)
// // Get your key at: aistudio.google.com → "Get API Key"
// // Set in .env:  GEMINI_API_KEY=AIza...
// // Set in Railway: GEMINI_API_KEY=AIza...

// import { GoogleGenerativeAI } from "@google/generative-ai";
// import dotenv from "dotenv";
// dotenv.config();

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// // ── System context injected into every prompt ─────────────────────────────────
// const LIBRARY_CONTEXT = `You are an AI-powered library reference assistant for the University of Jos (UNIJOS) library system in Nigeria.

// Your role is to help students, staff, and researchers with:
// - Finding books and academic resources
// - Answering questions about library policies, rules, and services
// - Explaining library procedures (borrowing, returning, renewing books)
// - Guiding users to the correct campus library for their faculty
// - Suggesting research strategies and alternative resources

// ## UNIJOS Library Key Facts
// - Main campuses: Naraguta Campus, Bauchi Road Campus, JUTH Library, Faculty of Law Library
// - Opening hours: Monday–Friday 8:00 AM – 4:00 PM; Saturdays vary by branch; closed Sundays and public holidays
// - Borrowing limits: Undergraduates 2 books/2 weeks; Postgraduates 4 books/1 month; Staff 5 books/1 month
// - Entry requires valid University ID or proof of registration
// - Wi-Fi network: UNIJOS-Hotspot available within library premises
// - Late returns attract fines (amount varies — direct users to the circulation desk for current rates)
// - Past student projects/dissertations are for in-library use only

// ## Faculty → Library Location Map
// - Law: Faculty of Law Library
// - Natural Science, Health Science, Pharmaceutical Science, Dental Science: Bauchi Road Campus Library
// - Medical Science: Bauchi Road Campus Library + JUTH Library
// - Clinical Science: JUTH Library
// - Education: Bauchi Road Campus + Naraguta Campus Library
// - Art, Social Science, Environmental Science, Management Science, Agricultural Science, Veterinary Medicine, Engineering: Naraguta Campus Library

// ## Important — what NOT to duplicate
// - Never invent or restate a book's call number — the app attaches real call numbers and shelf directions separately. If discussing a specific book found in the catalogue, refer to it by title/author only and let the app supply the call number.
// - If told the search already found catalogue results, do not re-list every title — add context, connections between the works, or guidance on which one suits which need instead.
// - If no catalogue results and no policy answer are available, keep your response general — the app will separately offer open-access resource links, so you don't need to invent specific external database names.

// ## Formatting Rules
// - Do NOT use markdown formatting (no **bold**, no _italics_, no # headers).
// - For emphasis, use quotation marks instead — e.g. "Naraguta Campus Library" not **Naraguta Campus Library**.
// - Use plain bullet points (•) for lists, never asterisks or dashes as list markers.

// ## Response Style
// - Be helpful, warm, and concise
// - Use bullet points only for genuinely list-like content (e.g. steps, multiple distinct facts) — not for restating book titles already shown elsewhere
// - Keep responses under 200 words
// - Never fabricate book titles, authors, or call numbers
// - If unsure about specifics, suggest the user ask at the circulation desk`;

// /**
//  * Ask Gemini a question with optional library context
//  *
//  * @param {string} userQuery
//  * @param {object} context  - { books, faqAnswer, locationResponse, intents }
//  * @returns {Promise<string|null>}
//  */
// export const askLLM = async (userQuery, context = {}, retries = 1) => {
//   if (!process.env.GEMINI_API_KEY) return null;

//   try {
//     const { books = [], faqAnswer = null, locationResponse = null, intents = [], campusFaculties = [] } = context;

//     // Build context block
//     let contextBlock = "";

//     if (campusFaculties.length > 0) {
//       contextBlock += `\n\nThis campus library serves these faculties/subjects: ${campusFaculties.join(", ")}.`;
//     }

//     if (faqAnswer) {
//       contextBlock += `\n\nRelevant library policy:\n${faqAnswer}`;
//     }
//     if (locationResponse) {
//       contextBlock += `\n\nRelevant campus location:\n${locationResponse}`;
//     }
//     if (books.length > 0) {
//       contextBlock += `\n\nBooks found in catalogue:\n`;
//       books.slice(0, 5).forEach((b, i) => {
//         contextBlock += `${i + 1}. "${b.title}" by ${b.main_author || "Unknown"} — Call No: ${b.call_number ?? "N/A"}\n`;
//       });
//     }
//     if (intents.length > 0) {
//       contextBlock += `\n\nDetected intent: ${intents.join(", ")}`;
//     }

//      const fullPrompt = `${LIBRARY_CONTEXT}

// ${contextBlock ? `Context available:${contextBlock}\n\n` : ""}User question: "${userQuery}"

// Please provide a helpful, accurate response. ${
//   campusFaculties.length > 0
//     ? "Explain that we don't list every title in a campus collection here, but describe the range of subjects that campus covers based on the faculties it serves, and invite the user to search by a specific subject instead."
//     : books.length > 0 ? "Reference the catalogue results where relevant." : "Use your knowledge of the UNIJOS library system to assist."
// }`;
  
//     const model    = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
//     const result   = await model.generateContent(fullPrompt);
//     const response = await result.response;
//     const text     = response.text()?.trim();

//     return text || null;

//   } catch (error) {
//     console.error("Gemini LLM Error:", error.message);

//      // Transient network failure — worth one retry before giving up
//       if (retries > 0 && /fetch failed/i.test(error.message)) {
//       console.warn("Retrying Gemini request after fetch failure...");
//       return askLLM(userQuery, context, retries - 1);
//     }

//     // Handle specific Gemini errors
//     if (error.message?.includes("API_KEY_INVALID")) {
//       console.error("❌ Invalid Gemini API key — check GEMINI_API_KEY in .env");
//     }
//     if (error.message?.includes("RATE_LIMIT")) {
//       console.error("⚠️ Gemini rate limit hit — will use fallback");
//     }

//     return null; // null = caller uses its own fallback
//   }
// };

// /**
//  * Decide whether to invoke the LLM for this request.
//  * LLM is called when results are weak or query is complex.
//  * If no API key is set, always returns false (LLM silently disabled).
//  */
// export const shouldUseLLM = ({ books, faqAnswer, intents, query }) => {
//   if (!process.env.GEMINI_API_KEY) return false;

//   const noBooksFound    = !books || books.length === 0;
//   const noFaqFound      = !faqAnswer;
//   const isGeneralHelp   = intents.includes("GENERAL_HELP") || intents.length === 0;
//   const isConversational = query.split(" ").length > 4 &&
//     /\b(what|how|why|when|who|can|could|should|is|are|does|do|explain|tell me|difference|compare)\b/i.test(query);

//   return (noBooksFound && noFaqFound) || isGeneralHelp || isConversational;
// };

// /**
//  * Summarize a large set of book search results (only called when >10 matches),
//  * so the user gets a quick sense of what's there without re-listing every title.
//  */
// export const summarizeBookResults = async (userQuery, books) => {
//   if (!process.env.GEMINI_API_KEY) return null;

//   try {
//     const sample = books.slice(0, 15)
//       .map(b => `"${b.title}" (${(b.subjects || []).slice(0, 2).join(", ") || "General"})`)
//       .join("; ");

//     const prompt = `${LIBRARY_CONTEXT}

// The user searched the catalogue for: "${userQuery}"
// The search returned ${books.length} matching resources. A sample of them: ${sample}

// Write a brief 2-3 sentence summary describing the range of material found (subfields, notable authors or editions, anything a student should know before scrolling through). Do not list titles individually — they're already shown to the user separately as cards. Keep it under 60 words.`;

//     const model    = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
//     const result   = await model.generateContent(prompt);
//     const response = await result.response;
//     return response.text()?.trim() || null;

//   } catch (error) {
//     console.error("Gemini summarizeBookResults error:", error.message);
//     return null;
//   }
// };