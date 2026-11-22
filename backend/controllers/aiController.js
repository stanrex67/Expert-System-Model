// controllers/aiController.js
// Pipeline:
//   1. Guard        → reject empty query
//   2. Location     → campus/faculty location fast-path
//   3. Greeting     → conversational fast-path
//   4. FAQ          → policy/rules fast-path
//   5. ML intent    → FastAPI classifier
//   6. Intent boost → rule-based hybrid boost
//   7. Keywords     → extract search terms
//   8. Book search  → semantic (FastAPI) → MongoDB fallback → relevance score
//   9. Annotate     → call-number navigation on locate queries
//  10. Build answer → assemble text from found data
//  11. LLM          → Claude fills gaps when results are weak or query is complex
//  12. Log + return

import Book    from "../models/book.js";
import User    from "../models/user.js";
import Log     from "../models/log.js";
import { extractKeywords, looksLikeGibberish }                             from "../utils/keywordExtractor.js";
import { explainCallNumber }                           from "../utils/callNumberExplainer.js";
import { getMLIntent, semanticSearch }                 from "../services/mlService.js";
import { findResourceLocation, formatLocationResponse, getFacultiesForCampus }from "../utils/resourceResolver.js";
import { findFAQResponse }                             from "../utils/faqResolver.js";
import { askLLM, shouldUseLLM, summarizeBookResults }                        from "../services/llmService.js";
import { findRelevantDatabases } from "../utils/databaseResolver.js";
import {
  escapeRegex, getRecommendations, keywordScore, hydrateFromCatalogue,
  rerankForUser, dedupeBooks, buildUserContext, isBirthdayToday,
} from "../services/personalizationService.js";


const OPEN_ACCESS_LINKS = [
  { title: "UNIJOS Open Access Resources", url: "https://www.unijos.edu.ng/open-access-resources" },
  { title: "UNIJOS Library E-books",        url: "https://www.unijos.edu.ng/library_ebooks" },
];

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const buildLocationAnswer = (matches) => {
  const lines = matches.map(({ faculty, location }) => {
    if (!location) return `📚 **${faculty}** — location not yet configured. Ask at the circulation desk.`;
    const locs = Array.isArray(location) ? location.join(" and ") : location;
    return `📚 **${faculty}** books are located at the **${locs}**.`;
  });
  return (
    lines.join("\n") +
    `\n\n🧭 Head to the circulation desk there and a librarian can point you to the right shelf.`
  );
};



// Words that describe the *task*, not the *subject*. If nothing else is left, there is no topic yet.
const GENERIC_TERMS = new Set([
  "research","project","assignment","thesis","dissertation","study","studies","topic",
  "help","need","want","book","books","textbook","textbooks","material","materials",
  "resource","resources","source","sources","reference","references","reading","readings",
  "find","search","look","looking","something","anything","academic","paper","papers",
  "work","write","writing","please","good","best","some","any","could","would","review","reviews",
  "recommend","recommendation","recommendations","suggest","suggestion","suggestions",
  "read","course","courses","give","show","list","get","tell","about",
  "when","what","where","which","who","why","how","can","should",
]);
const BOOK_NOUN = /\b(books?|textbooks?|titles?|readings?|references?)\b/;
const BOOK_VERB = /\b(find|search|look(?:ing)? for|recommend|suggest|show|list|locate)\b/;


export const askAI = async (req, res) => {
  const startTime = Date.now();

  try {
    const { query, conversationId } = req.body;

    // ── 1. Guard ──────────────────────────────────────────────────────────────
    if (!query || !query.trim()) {
      await Log.create({ type: "AI", user: req.user?._id, query: null,
        intent: [], response: "Query is required", success: false });
      return res.status(400).json({ message: "Query is required" });
    }

    const q = query.toLowerCase().trim();

    // ── Load user ─────────────────────────────────────────────────────────────
    let user = null;
    if (req.user?.id) user = await User.findById(req.user.id);
    const userName = user?.name ? `, ${user.name}` : "";
    const userContext = buildUserContext(user);


    const slimBook = (b) => ({
  _id: b._id, title: b.title, main_author: b.main_author, call_number: b.call_number,
  year: b.year, edition: b.edition, publisher: b.publisher,
  subjects: (b.subjects || []).slice(0, 4), navigation: b.navigation, location_note: b.location_note,
});

    // ── Find-or-create conversation ───────────────────────────────────────────
    let conversation = null;
    if (user) {
      if (conversationId) {
        conversation = user.conversations.id(conversationId);
      }
      if (!conversation) {
        user.conversations.push({ title: query.trim(), messages: [], createdAt: new Date(), updatedAt: new Date() });
        conversation = user.conversations[user.conversations.length - 1]; // pushed subdoc, has its own _id
      }
    }

    const lastAi = conversation ? [...conversation.messages].reverse().find(m => m.sender === "ai") : null;
    const awaitingTopic = Array.from(lastAi?.intent || []).includes("BOOK_CLARIFY");
    const history = conversation
      ? conversation.messages.slice(-6).map(m => ({
          role: m.sender === "user" ? "user" : "ai",
          text: String(m.text || "").slice(0, 300),
        }))
      : [];

    let databases = [];

    const respond = async (payload) => {
  if (user && conversation) {
    conversation.messages.push({
      sender: "user",
      text: query.trim(),
      timestamp: new Date(),
    });
    conversation.messages.push({
      sender: "ai",
      text: payload.data?.answer || payload.message || "",
      intent: payload.intent || [],
      books: (payload.data?.books || []).slice(0, 20).map(slimBook),
      recommendations: (payload.data?.recommendations || []).slice(0, 5).map(slimBook),
      databases: payload.data?.databases || [],
      openAccessLinks: payload.data?.openAccessLinks || [],
      timestamp: new Date(),
    });
    conversation.updatedAt = new Date();
    await user.save();
  }
  return res.json({ ...payload, conversationId: conversation?._id });
};

    // ── 2. Campus location lookup ───────────────────────────────────────────────
    const locationMatches  = findResourceLocation(query);
    const locationResponse = formatLocationResponse(locationMatches);

    // "where", "which library", "which campus" = location INTENT,
    // even if the word "find" is present.
    const hasLocationIntent =
      /\b(where|which (library|campus|building|section)|location of|located)\b/.test(q);

    // Pure location: user ONLY wants the place, not a title list
    const isPureLocationQuery =
      locationMatches && hasLocationIntent &&
      !/\b(recommend|suggest|list|show me (some|a few))\b/.test(q);

    if (isPureLocationQuery) {
      const answer = buildLocationAnswer(locationMatches);
      await Log.create({ type: "AI", user: req.user?._id, query,
        intent: ["LOCATION_INFO"], response: answer,
        success: true, responseTime: Date.now() - startTime });
      return respond({ success: true, intent: ["LOCATION_INFO"],
        data: { answer, books: [], recommendations: [] } });
    }

    // ── 2b. General (non-faculty-specific) library location query ────────────
    const isGeneralLibraryLocationQuery =
      !locationMatches &&
      hasLocationIntent &&
      /\blibrar(y|ies)\b/.test(q);

    if (isGeneralLibraryLocationQuery) {
      const answer =
        `📚 The University of Jos Library system has four main locations:\n\n` +
        `• "Naraguta Campus Library" — Arts, Social Science, Environmental Science, Management Science, Agricultural Science, Veterinary Medicine, Engineering, Education\n` +
        `• "Bauchi Road Campus Library" — Natural Science, Health Science, Pharmaceutical Science, Dental Science, Medical Science, Education\n` +
        `• "JUTH Library" — Clinical Science, Medical Science\n` +
        `• "Faculty of Law Library" — Law\n\n` +
        `🧭 Visit the circulation desk at the relevant campus and a librarian can guide you from there.`;

      await Log.create({ type: "AI", user: req.user?._id, query,
        intent: ["LOCATION_INFO"], response: answer,
        success: true, responseTime: Date.now() - startTime });

      return respond({ success: true, intent: ["LOCATION_INFO"],
        data: { answer, books: [], recommendations: [] } });
    }

    // // ── 2c. "What books are at campus X" — browsing a whole collection isn't
    // // a keyword search; guide them to narrow by subject instead.
    // const isBrowseCampusQuery =
    //   /\b(what books|which books|list of books|all books)\b/.test(q) &&
    //   /\b(campus|library|naraguta|bauchi|juth)\b/.test(q);

 

// ── 2c. "What books are at campus X" — browsing a whole collection isn't
// a keyword search; let the LLM answer naturally using real faculty context.
const isBrowseCampusQuery =
  /\b(what books|which books|list of books|all books)\b/.test(q) &&
  /\b(campus|library|naraguta|bauchi|juth)\b/.test(q);

if (isBrowseCampusQuery) {
  const faculties = getFacultiesForCampus(query);

  const llmAnswer = await askLLM(query, {
    intents: ["GENERAL_HELP"],
    campusFaculties: faculties, userContext,
  });

  const fallback =
    `📚 Our campus libraries hold thousands of titles, so I can't list an entire collection here — ` +
    `but I can help you search within one.\n\n` +
    `Try narrowing by subject, e.g. "Find books on engineering" or "Find books on law", ` +
    `and I'll pull matching titles along with which campus holds them.`;

  const answer = llmAnswer || fallback;

  await Log.create({ type: "AI", user: req.user?._id, query,
    intent: ["GENERAL_HELP"], response: answer,
    success: true, responseTime: Date.now() - startTime });

  return respond({ success: true, intent: ["GENERAL_HELP"], data: {
    answer, books: [], recommendations: []
  }});
}

// ── 2c. Institution-level location question — "where is the university/
// campus located" (geography, not a book or a specific faculty/library).
const isInstitutionLocationQuery =
  hasLocationIntent &&
  !locationMatches &&
  /\b(university of jos|unijos)\b/.test(q) &&
  !/\b(book|books|library|libraries|shelf|section|call number)\b/.test(q);

if (isInstitutionLocationQuery) {
  const llmAnswer = await askLLM(query, { intents: ["GENERAL_HELP"], userContext });

  const answer = llmAnswer
    ? `🤔 ${llmAnswer}`
    : `🤔 I'm not able to look that up right now — the University of Jos is located in Jos, Plateau State, Nigeria, in West Africa. For anything about our library services, I'm happy to help directly!`;

  await Log.create({ type: "AI", user: req.user?._id, query,
    intent: ["GENERAL_HELP"], response: answer,
    success: true, responseTime: Date.now() - startTime });

  return respond({ success: true, intent: ["GENERAL_HELP"], data: {
    answer, books: [], recommendations: []
  }});
}

    // ── 3. Greeting / small-talk ──────────────────────────────────────────────
    if (/\b(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(q)) {

      const birthdayMessage = isBirthdayToday(user?.profile?.dateOfBirth)
        ? `\n\n🎂 Happy birthday${userName}! Wishing you a wonderful day.`
        : "";

      return respond({
        success: true,
        intent: ["GREETING"],
        data: {
          answer: `👋 ${getGreeting()}${userName}! I'm your University of Jos AI virtual library assistant.${birthdayMessage}\n\nHow may I assist you today?`,
          books: [],
          recommendations: [],
        },
      });
    }

    if (/\b(what can you do|who are you)\b/.test(q)) {
      return respond({ success: true, intent: ["SMALL_TALK"], data: {
        answer: `😊 I can help you:\n\n• 📚 Find books by subject, title, or author\n• 📍 Locate where books are shelved\n• 🏛️ Tell you which campus library holds your faculty's books\n• ℹ️ Answer questions about library rules, hours, and services\n• 🤖 Answer complex research questions using AI\n\nTry: "Find books on engineering" or "Where are law books?"`,
        books: [], recommendations: []
      }});
    }

    // ── 4. FAQ lookup ─────────────────────────────────────────────────────────
    const faqResult = findFAQResponse(query);
    let faqAnswer = null;
    let faqTips   = [];
    if (faqResult) {
      faqAnswer = typeof faqResult === "string" ? faqResult : faqResult.answer;
      faqTips   = typeof faqResult === "string" ? [] : (faqResult.tips || []);
    }

    const isBookSearch =
      (q.includes("find") || q.includes("search") || q.includes("locate")) &&
      (q.includes("book") || q.includes("title") || q.includes("author") || q.includes("subject"));

      if (isBookSearch && !/\bhow (do|can|to|does)\b/.test(q)) { faqAnswer = null; faqTips = []; }

    if (faqAnswer && !isBookSearch) {
      let answer = `ℹ️ ${faqAnswer}`;
      if (faqTips.length > 0) answer += "\n\n💡 Tips:\n" + faqTips.map(t => `- ${t}`).join("\n");
      if (locationResponse) answer += `\n\n${locationResponse}`;
      await Log.create({ type: "AI", user: req.user?._id, query,
        intent: ["LIBRARY_INFO"], response: answer,
        success: true, responseTime: Date.now() - startTime });
      return respond({ success: true, intent: ["LIBRARY_INFO"],
        data: { answer, books: [], recommendations: [] } });
    }

        // ── 4b. Definition / conceptual query — route straight to the LLM for a
    // short explanation, skip book search entirely unless they also ask for resources.
    const isDefinitionQuery =
      /\b(define|definition of|what is|who is|what does .* mean|meaning of|explain)\b/.test(q) &&
      !/\b(find|search|locate|book|books|recommend)\b/.test(q);

    if (isDefinitionQuery) {
        const llmAnswer = await askLLM(query, { intents: ["DEFINITION"], userContext  });

        const answer = llmAnswer
          ? `🤔 ${llmAnswer}\n\n📚 Want me to also find books on this topic? Just ask — e.g. "Find books on ${query.trim()}".`
          : `🤔 I couldn't generate an explanation right now. Try asking "Find books on ${query.trim()}" instead, and I can pull relevant titles from the catalogue.`;

        await Log.create({ type: "AI", user: req.user?._id, query,
          intent: ["DEFINITION"], response: answer,
          success: true, responseTime: Date.now() - startTime });

        return respond({ success: true, intent: ["DEFINITION"], data: {
          answer, books: [], recommendations: []
        }});
      }

    // ── 5. ML intent ──
const intentString = await getMLIntent(query);
let intents = intentString ? intentString.split("+").map(s => s.trim()).filter(Boolean) : [];
if (faqAnswer && !intents.includes("LIBRARY_INFO")) intents.push("LIBRARY_INFO");
if (/\b(where (is|are|can)|locate|which shelf|which section|location of)\b/.test(q) &&
    !intents.includes("LOCATE_BOOK")) intents.push("LOCATE_BOOK");

// ── 6. Keywords + topic ──
const keywords = extractKeywords(query.replace(/\bliterature reviews?\b/gi, " ")).filter(w => w.length >= 3);
const topicKeywords = keywords.filter(w => !GENERIC_TERMS.has(w.toLowerCase()));
const hasTopic = topicKeywords.length > 0;
const topicQuery = topicKeywords.join(" ");

const explicitBookRequest = BOOK_NOUN.test(q) || BOOK_VERB.test(q);
const wantsPersonalRecs = !!user && !hasTopic &&
  /\b(recommend|suggest|suggestions?|what should i read)\b/.test(q);

// ── 6b. Wants books but hasn't said about what → talk, don't search ──
const isVagueBookRequest =
  !hasTopic && !faqAnswer && !hasLocationIntent && !wantsPersonalRecs &&
  (explicitBookRequest ||
   intents.some(i => ["RESEARCH_HELP", "FIND_BOOK", "RECOMMEND_BOOK"].includes(i)));

if (isVagueBookRequest) {
  const llmAnswer = await askLLM(query, {
    intents: ["BOOK_CLARIFY"], mode: "clarify_topic", userContext, history,
  });
  const answer = llmAnswer ||
    `Happy to help with your literature review! What topic or course is it on? ` +
    `Once you tell me, I can search the catalogue for matching titles.`;

  await Log.create({ type: "AI", user: req.user?._id, query,
    intent: ["BOOK_CLARIFY"], response: answer,
    success: true, responseTime: Date.now() - startTime });

  return respond({ success: true, intent: ["BOOK_CLARIFY"], data: {
    answer, books: [], recommendations: [], databases: [], openAccessLinks: [],
  }});
}

// ── 6c. Gibberish guard ──
const gibberishCount = keywords.filter(looksLikeGibberish).length;
const mostlyGibberish = keywords.length > 0 && gibberishCount / keywords.length >= 0.5;
if (keywords.length === 0 || mostlyGibberish) {
  return respond({ success: true, intent: ["GENERAL_HELP"], data: {
    answer:
      `🤔 I didn't quite catch that. Try asking me something like:\n\n` +
      `• "Find books on law"\n• "Where can I find engineering books?"\n• "How do I borrow a book?"`,
    books: [], recommendations: [],
  }});
}

// ── 6d. Decide whether to search the catalogue ──
const researchAdviceOnly = intents.includes("RESEARCH_HELP") && !explicitBookRequest;
const wantsSearch =
  hasTopic && !researchAdviceOnly &&
  (explicitBookRequest || awaitingTopic ||
   intents.includes("FIND_BOOK") || intents.includes("RECOMMEND_BOOK"));

intents = intents.filter(i => i !== "FIND_BOOK" && i !== "RECOMMEND_BOOK");
if (wantsSearch)       intents.push("FIND_BOOK");
if (wantsPersonalRecs) intents.push("RECOMMEND_BOOK");
if (intents.length === 0) intents = ["GENERAL_HELP"];

const conds = topicKeywords.map((word) => {
  const rx = `\\b${escapeRegex(word)}\\b`;
  return { $or: [
    { title:       { $regex: rx, $options: "i" } },
    { subjects:    { $regex: rx, $options: "i" } },
    { main_author: { $regex: rx, $options: "i" } },
  ]};
});
    // ── 8. User history + recommendations ────────────────────────────────────
let recommendations = [];
if (user) {
  user.search_history = user.search_history || [];
  const last = user.search_history[user.search_history.length - 1];
  if (last?.query !== query) user.search_history.push({ query, timestamp: new Date() });
  if (user.search_history.length > 50) user.search_history = user.search_history.slice(-50);
  if (wantsPersonalRecs) recommendations = await getRecommendations(user, 5);
}

    // ── 9. Book search ────────────────────────────────────────────────────────
    // let books = [];

    // if (intents.includes("FIND_BOOK") || intents.includes("RECOMMEND_BOOK")) {
    //   try { books = await semanticSearch(query); } catch { books = []; }

    //   if ((!books || books.length === 0) && keywords.length > 0) {
    //     const conds = keywords.map(word => {
    //     const rx = `\\b${word}\\b`;
    //     return {
    //       $or: [
    //         { title:       { $regex: rx, $options: "i" } },
    //         { subjects:    { $regex: rx, $options: "i" } },
    //         { main_author: { $regex: rx, $options: "i" } },
    //         { notes:       { $regex: rx, $options: "i" } }
    //       ]
    //     };
    //   });
    //     books = await Book.find({ $and: conds }).limit(20);
    //     if (books.length === 0) books = await Book.find({ $or: conds }).limit(20);

    //     const scored = books.map(book => {
    //       let score = 0;
    //       keywords.forEach(word => {
    //         const rx = new RegExp(word, "i");
    //         if (rx.test(book.title))                   score += 6;
    //         if (book.subjects?.some(s => rx.test(s))) score += 5;
    //         if (rx.test(book.main_author))             score += 3;
    //         if (rx.test(book.notes))                   score += 1;
    //       });
    //       return { book, score };
    //     });
    //     scored.sort((a, b) => b.score - a.score);
    //     books = scored.filter(i => i.score >= 3).map(i => i.book).slice(0, 50); 
    //   }
    // }

    let books = [];
if (wantsSearch) {
  let hits = [];
  try { hits = await semanticSearch(topicQuery); } catch { hits = []; }

  if (hits.length) {
    books = await hydrateFromCatalogue(hits);
  } else {
    books = await Book.find({ $and: conds }).limit(30).lean();
    if (!books.length) books = await Book.find({ $or: conds }).limit(30).lean();
    books = keywordScore(books, topicKeywords);
  }
  books = rerankForUser(dedupeBooks(books), user).slice(0, 50);
}

const noResultsAfterSearch = wantsSearch && books.length === 0;
const wantsDatabases = /\b(databases?|journals?|articles?|e-?resources?|e-?books?|online|papers?|scholar)\b/.test(q);
databases = (wantsSearch && (wantsDatabases || noResultsAfterSearch)) ? findRelevantDatabases(query, 3) : [];

const showLocation = !!locationResponse && (hasLocationIntent || intents.includes("LOCATE_BOOK"));

    // Annotate with navigation
    if (intents.includes("LOCATE_BOOK") && books.length > 0) {
      books = books.map(book => {
        const b = book.toObject ? book.toObject() : { ...book };
        return { ...b, navigation: explainCallNumber(b.call_number),
          location_note: `📍 Call Number: ${b.call_number ?? "Not yet catalogued"}` };
      });
    }

    // Pure locate — specific title
    if (intents.includes("LOCATE_BOOK") && !intents.includes("FIND_BOOK")) {
      const book = await Book.findOne({ title: { $regex: keywords.map(escapeRegex).join("|"), $options: "i" } })
      if (!book) return respond({ success: false, intent: intents,
        message: "❌ Book not found. Try a more specific title." });
      return respond({ success: true, intent: intents, data: {
        answer: `📍 Here is where to find "${book.title}":`,
        ...book.toObject(),
        navigation: explainCallNumber(book.call_number),
        location_note: `📍 Call Number: ${book.call_number ?? "Not yet catalogued"}`,
        books: [], recommendations: []
      }});
    }

    // Persist last-query state (folded into user object — saved once inside respond())
    if (user) {
      user.lastQuery = query;
      user.lastBooks = books.map(b => b.title);
    }

    // ── 10. Build base answer ─────────────────────────────────────────────────

    const parts = [];
    let summaryAdded = false;   // ← NEW

    if (books.length > 0)
      parts.push(`📚 Found ${books.length} relevant resource${books.length > 1 ? "s" : ""} for your query.`);

    if (books.length >= 5) {
      const summary = await summarizeBookResults(query, books);
      if (summary) {
        parts.push(`🤖 ${summary}`);
        summaryAdded = true;   // ← NEW
      }
    }

    if (intents.includes("LIBRARY_INFO") && faqAnswer) {
      let block = `ℹ️ ${faqAnswer}`;
      if (faqTips.length) block += "\n\n💡 Tips:\n" + faqTips.map(t => `- ${t}`).join("\n");
      parts.push(block);
    }

if (showLocation) parts.push(locationResponse);

    if (recommendations.length > 0 && books.length === 0)
      parts.push("🎯 Here are some picks based on your department and recent searches.");

      if (databases.length > 0) {
      parts.push(
        `🌐 You may also find these electronic databases useful:\n` +
        databases.map(db =>
          `• "${db.name}"${db.accessNote ? ` — ${db.accessNote}` : ""}\n   ${db.url}`
        ).join("\n")
      );
    }


    // ── Ambiguity guard — very short/single-word queries get a soft, honest
// response instead of a fully-committed guess. Only fires when there's
// no real catalogue match or FAQ backing the answer.
const isVeryShortQuery = keywords.length <= 1 && query.trim().split(/\s+/).length <= 2;

if (isVeryShortQuery && books.length === 0 && !faqAnswer && !locationResponse) {
  const term = query.trim();
  const guess = findResourceLocation(term); // does this word map to a known faculty at all?

  let answer;
  if (guess && guess.length > 0) {
    // We do have a plausible faculty match — offer it as a lead, not a fact.
    const { faculty, location } = guess[0];
    const locText = Array.isArray(location) ? location.join(" and ") : location;
    answer =
      `🤔 "${term}" could relate to a few things — could you tell me a bit more about what you're looking for?\n\n` +
      `If it's related to "${faculty}", our collection for that is at "${locText}" — happy to search for specific titles once I know more.`;
  } else {
    answer =
      `🤔 "${term}" could mean a few things — could you tell me more about what you're looking for?\n\n` +
      `For example: "Find books on ${term}" or "Where can I find resources about ${term}?"`;
  }

  await Log.create({ type: "AI", user: req.user?._id, query,

    intent: ["GENERAL_HELP"], response: answer,
    success: true, responseTime: Date.now() - startTime });

  return respond({ success: true, intent: ["GENERAL_HELP"], data: {
    answer, books: [], recommendations: []
  }});
}

    // ── 11. LLM enrichment ───────────────────────────────────────────────────
  
const useLLM = shouldUseLLM({ books, faqAnswer, intents, query }) && !summaryAdded;   

    if (useLLM) {
      const llmAnswer = await askLLM(query, {
        books,
        faqAnswer,
        locationResponse: showLocation ? locationResponse : null,
        intents,
        userContext,
        history,
      });

      if (llmAnswer) {
        if (parts.length > 0) {
          parts.push(`\n🤖 AI Assistant:\n${llmAnswer}`);
        } else {
          parts.push(`🤖 ${llmAnswer}`);
          if (noResultsAfterSearch) {
            parts.push(
              `\n🌐 Open Access Resources:\n` +
              OPEN_ACCESS_LINKS.map((l, i) => `${i + 1}. ${l.title}\n   ${l.url}`).join("\n")
            );
          }
        }
      } else if (parts.length === 0) {
        parts.push(
          `❌ I could not find relevant resources in the physical library collection.\n\n` +
          `🌐 You may try these Open Access Resources:\n` +
          OPEN_ACCESS_LINKS.map((l, i) => `${i + 1}. ${l.title}\n   ${l.url}`).join("\n") +
          `\n\n💡 You can also try:\n• Searching with a broader keyword\n• Using a different subject term\n• Searching by author name`
        );
      }
    } else if (parts.length === 0) {
      parts.push(
        `❌ No relevant resources found. Try:\n\n` +
        `• "Find books on engineering"\n• "Where are law books?"\n• "How do I borrow a book?"`
      );
    }

    const answer = parts.join("\n\n");

    // ── 12. Log + respond ─────────────────────────────────────────────────────
    await Log.create({ type: "AI", user: req.user?._id, query, intent: intents,
      response: answer, success: true, responseTime: Date.now() - startTime });

    //   const slimBook = (b) => ({
    //   _id: b._id, title: b.title, main_author: b.main_author, call_number: b.call_number,
    //   year: b.year, edition: b.edition, publisher: b.publisher,
    //   subjects: (b.subjects || []).slice(0, 4), navigation: b.navigation, location_note: b.location_note,
    // });

    // return respond({
    //   success: true, intent: intents,
    //   data: {
    //     answer,
    //     books: (payload.data?.books || []).slice(0, 20).map(slimBook),
    //     totalBooks:      books.length,
    //     recommendations: recommendations || [],
    //     databases:       databases       || [], 
    //     openAccessLinks: books.length === 0 ? OPEN_ACCESS_LINKS : [],
    //   }
    // });

    return respond({
  success: true,
  intent: intents,
  data: {
    answer,
    books,
    totalBooks: books.length,
    recommendations: recommendations || [],
    databases: databases || [],
    openAccessLinks: noResultsAfterSearch ? OPEN_ACCESS_LINKS : [],
  },
});

  } catch (error) {
    console.error("AI Error:", error);
    await Log.create({ type: "AI", user: req.user?._id, query: req.body?.query,
      intent: [], response: error.message, success: false,
      responseTime: Date.now() - startTime });
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

