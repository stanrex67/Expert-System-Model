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

    let databases = [];

    // ── Response helper — logs this turn onto the conversation, then replies ──
    const respond = async (payload) => {
      if (user && conversation) {
        conversation.messages.push({ sender: "user", text: query, timestamp: new Date() });
        conversation.messages.push({
          sender: "ai",
          text: payload.data?.answer || payload.message || "",
          intent: payload.intent || [],
          books: payload.data?.books || [],
          recommendations: payload.data?.recommendations || [],
          databases: payload.data?.databases || [], 
          openAccessLinks: payload.data?.openAccessLinks || [],
          timestamp: new Date(),
        });
        conversation.updatedAt = new Date();
        await user.save();
      }
      return res.json({ ...payload, conversationId: conversation?._id || null });
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
    campusFaculties: faculties, // new context field — see llmService.js addition below
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
  const llmAnswer = await askLLM(query, { intents: ["GENERAL_HELP"] });

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
      return respond({ success: true, intent: ["GREETING"], data: {
        answer: `👋 ${getGreeting()}${userName}! I'm your University of Jos AI virtual library assistant.\n\nHow may I assist you today?`,
        books: [], recommendations: []
      }});
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
        const llmAnswer = await askLLM(query, { intents: ["DEFINITION"] });

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

    // ── 5. ML intent ──────────────────────────────────────────────────────────
    let intentString = await getMLIntent(query);
    let intents = intentString ? intentString.split("+").map(s => s.trim()) : [];
    if (faqAnswer && !intents.includes("LIBRARY_INFO")) intents.push("LIBRARY_INFO");

    // ── 6. Hybrid intent boost ────────────────────────────────────────────────
    if (/\b(where (is|are|can)|locate|which shelf|which section|location of)\b/.test(q) &&
        !intents.includes("LOCATE_BOOK")) intents.push("LOCATE_BOOK");
    if (/\b(find|search|book|books|look for|any books|what books)\b/.test(q) &&
        !intents.includes("FIND_BOOK")) intents.push("FIND_BOOK");

    // ── 7. Keywords ───────────────────────────────────────────────────────────
    // ── 7. Keywords ───────────────────────────────────────────────────────────
const keywords = extractKeywords(query).filter(w => w.length >= 3); // drop 1–2 letter fragments

const conds = keywords.map(word => {
  const rx = `\\b${word}\\b`;
  return {
    $or: [
      { title:       { $regex: rx, $options: "i" } },
      { subjects:    { $regex: rx, $options: "i" } },
      { main_author: { $regex: rx, $options: "i" } },
      { notes:       { $regex: rx, $options: "i" } }
    ]
  };
});

 const gibberishCount = keywords.filter(looksLikeGibberish).length;
const mostlyGibberish = keywords.length > 0 && gibberishCount / keywords.length >= 0.5;

    if (keywords.length === 0 || mostlyGibberish) {
      return respond({ success: true, intent: ["GENERAL_HELP"], data: {
        answer:
          `🤔 I didn't quite catch that. Try asking me something like:\n\n` +
          `• "Find books on law"\n` +
          `• "Where can I find engineering books?"\n` +
          `• "How do I borrow a book?"`,
        books: [], recommendations: []
      }});
    }

    if (keywords.length === 0) intents = ["GENERAL_HELP"];

    // ── 8. User history + recommendations ────────────────────────────────────
    let recommendations = [];
    if (user) {
      user.search_history = user.search_history || [];
      user.search_history.push({ query, timestamp: new Date() });
      const hq = user.search_history.map(i => i.query);
      recommendations = await Book.find({ subjects: { $in: hq } }).limit(5);
      // NOTE: no await user.save() here — respond() saves once at the end,
      // avoiding the double-save that used to happen in step 9/persist.
    }

    // ── 9. Book search ────────────────────────────────────────────────────────
    let books = [];

    if (intents.includes("FIND_BOOK") || intents.includes("RECOMMEND_BOOK")) {
      try { books = await semanticSearch(query); } catch { books = []; }

      if ((!books || books.length === 0) && keywords.length > 0) {
        const conds = keywords.map(word => {
        const rx = `\\b${word}\\b`;
        return {
          $or: [
            { title:       { $regex: rx, $options: "i" } },
            { subjects:    { $regex: rx, $options: "i" } },
            { main_author: { $regex: rx, $options: "i" } },
            { notes:       { $regex: rx, $options: "i" } }
          ]
        };
      });
        books = await Book.find({ $and: conds }).limit(20);
        if (books.length === 0) books = await Book.find({ $or: conds }).limit(20);

        const scored = books.map(book => {
          let score = 0;
          keywords.forEach(word => {
            const rx = new RegExp(word, "i");
            if (rx.test(book.title))                   score += 6;
            if (book.subjects?.some(s => rx.test(s))) score += 5;
            if (rx.test(book.main_author))             score += 3;
            if (rx.test(book.notes))                   score += 1;
          });
          return { book, score };
        });
        scored.sort((a, b) => b.score - a.score);
        books = scored.filter(i => i.score >= 3).map(i => i.book).slice(0, 50); 
      }
    }

    databases = findRelevantDatabases(query, 3);

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
      const book = await Book.findOne({ title: { $regex: keywords.join("|"), $options: "i" } });
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

    if (locationResponse) parts.push(locationResponse);

    if (recommendations.length > 0 && books.length === 0)
      parts.push("🎯 Based on your search history, you might also like the books below.");

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
      const llmAnswer = await askLLM(query, { books, faqAnswer, locationResponse, intents });

      if (llmAnswer) {
        if (parts.length > 0) {
          parts.push(`\n🤖 AI Assistant:\n${llmAnswer}`);
        } else {
          parts.push(`🤖 ${llmAnswer}`);
          if (books.length === 0) {
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

    return respond({
      success: true, intent: intents,
      data: {
        answer,
        books:           books           || [],
        totalBooks:      books.length,
        recommendations: recommendations || [],
        databases:       databases       || [], 
        openAccessLinks: books.length === 0 ? OPEN_ACCESS_LINKS : [],
      }
    });

  } catch (error) {
    console.error("AI Error:", error);
    await Log.create({ type: "AI", user: req.user?._id, query: req.body?.query,
      intent: [], response: error.message, success: false,
      responseTime: Date.now() - startTime });
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

// // controllers/aiController.js
// // Pipeline:
// //   1. Guard        → reject empty query
// //   2. Location     → campus/faculty location fast-path
// //   3. Greeting     → conversational fast-path
// //   4. FAQ          → policy/rules fast-path
// //   5. ML intent    → FastAPI classifier
// //   6. Intent boost → rule-based hybrid boost
// //   7. Keywords     → extract search terms
// //   8. Book search  → semantic (FastAPI) → MongoDB fallback → relevance score
// //   9. Annotate     → call-number navigation on locate queries
// //  10. Build answer → assemble text from found data
// //  11. LLM          → Claude fills gaps when results are weak or query is complex
// //  12. Log + return

// import Book    from "../models/book.js";
// import User    from "../models/user.js";
// import Log     from "../models/log.js";
// import { extractKeywords, looksLikeGibberish }                             from "../utils/keywordExtractor.js";
// import { explainCallNumber }                           from "../utils/callNumberExplainer.js";
// import { getMLIntent, semanticSearch }                 from "../services/mlService.js";
// import { findResourceLocation, formatLocationResponse }from "../utils/resourceResolver.js";
// import { findFAQResponse }                             from "../utils/faqResolver.js";
// import { askLLM, shouldUseLLM }                        from "../services/llmService.js";

// const OPEN_ACCESS_LINKS = [
//   { title: "UNIJOS Open Access Resources", url: "https://www.unijos.edu.ng/open-access-resources" },
//   { title: "UNIJOS Library E-books",        url: "https://www.unijos.edu.ng/library_ebooks" },
// ];

// const getGreeting = () => {
//   const h = new Date().getHours();
//   if (h < 12) return "Good morning";
//   if (h < 17) return "Good afternoon";
//   return "Good evening";
// };

// const buildLocationAnswer = (matches) => {
//   const lines = matches.map(({ faculty, location }) => {
//     if (!location) return `📚 **${faculty}** — location not yet configured. Ask at the circulation desk.`;
//     const locs = Array.isArray(location) ? location.join(" and ") : location;
//     return `📚 **${faculty}** books are located at the **${locs}**.`;
//   });
//   return (
//     lines.join("\n") +
//     `\n\n🧭 Head to the circulation desk there and a librarian can point you to the right shelf.`
//   );
// };


// export const askAI = async (req, res) => {
//   const startTime = Date.now();

//   try {
//     const { query, conversationId } = req.body;

//     // ── 1. Guard ──────────────────────────────────────────────────────────────
//     if (!query || !query.trim()) {
//       await Log.create({ type: "AI", user: req.user?._id, query: null,
//         intent: [], response: "Query is required", success: false });
//       return res.status(400).json({ message: "Query is required" });
//     }

//     const q = query.toLowerCase().trim();

//     // ── Load user ─────────────────────────────────────────────────────────────
//     let user = null;
//     if (req.user?.id) user = await User.findById(req.user.id);
//     const userName = user?.name ? `, ${user.name}` : "";

//     let conversation = null;
//       if (user) {
//         if (conversationId) {
//           conversation = user.conversations.id(conversationId);
//         }
//         if (!conversation) {
//           conversation = { title: query.trim(), messages: [], createdAt: new Date(), updatedAt: new Date() };
//           user.conversations.push(conversation);
//           conversation = user.conversations[user.conversations.length - 1]; // get the pushed subdoc with its _id
//         }
//       }

//     // ── 2. Campus location lookup ─────────────────────────────────────────────
//    // ── 2. Campus location lookup ─────────────────────────────
// const locationMatches  = findResourceLocation(query);
// const locationResponse = formatLocationResponse(locationMatches);

// // "where", "which library", "which campus" = location INTENT,
// // even if the word "find" is present.
// const hasLocationIntent =
//   /\b(where|which (library|campus|building|section)|location of|located)\b/.test(q);

// // Pure location: user ONLY wants the place, not a title list
// const isPureLocationQuery =
//   locationMatches && hasLocationIntent &&
//   !/\b(recommend|suggest|list|show me (some|a few))\b/.test(q);

// if (isPureLocationQuery) {
//   const answer = buildLocationAnswer(locationMatches); // 👈 friendly sentence, see below
//   await Log.create({ type: "AI", user: req.user?._id, query,
//     intent: ["LOCATION_INFO"], response: answer,
//     success: true, responseTime: Date.now() - startTime });
//   return res.json({ success: true, intent: ["LOCATION_INFO"],
//     data: { answer, books: [], recommendations: [] } });
// }


//     // ── 3. Greeting / small-talk ──────────────────────────────────────────────
//     if (/\b(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(q)) {
//       return res.json({ success: true, intent: ["GREETING"], data: {
//         answer: `👋 ${getGreeting()}${userName}! I'm your University of Jos AI virtual library assistant.\n\nHow may I assist you today?`,
//         books: [], recommendations: []
//       }});
//     }

//     if (/\b(what can you do|who are you)\b/.test(q)) {
//       return res.json({ success: true, intent: ["SMALL_TALK"], data: {
//         answer: `😊 I can help you:\n\n• 📚 Find books by subject, title, or author\n• 📍 Locate where books are shelved\n• 🏛️ Tell you which campus library holds your faculty's books\n• ℹ️ Answer questions about library rules, hours, and services\n• 🤖 Answer complex research questions using AI\n\nTry: "Find books on engineering" or "Where are law books?"`,
//         books: [], recommendations: []
//       }});
//     }

//     // ── 4. FAQ lookup ─────────────────────────────────────────────────────────
//     const faqResult = findFAQResponse(query);
//     let faqAnswer = null;
//     let faqTips   = [];
//     if (faqResult) {
//       faqAnswer = typeof faqResult === "string" ? faqResult : faqResult.answer;
//       faqTips   = typeof faqResult === "string" ? [] : (faqResult.tips || []);
//     }

//     const isBookSearch =
//       (q.includes("find") || q.includes("search") || q.includes("locate")) &&
//       (q.includes("book") || q.includes("title") || q.includes("author") || q.includes("subject"));

//     if (faqAnswer && !isBookSearch) {
//       let answer = `ℹ️ ${faqAnswer}`;
//       if (faqTips.length > 0) answer += "\n\n💡 Tips:\n" + faqTips.map(t => `- ${t}`).join("\n");
//       if (locationResponse) answer += `\n\n${locationResponse}`;
//       await Log.create({ type: "AI", user: req.user?._id, query,
//         intent: ["LIBRARY_INFO"], response: answer,
//         success: true, responseTime: Date.now() - startTime });
//       return res.json({ success: true, intent: ["LIBRARY_INFO"],
//         data: { answer, books: [], recommendations: [] } });
//     }

//     // ── 5. ML intent ──────────────────────────────────────────────────────────
//     let intentString = await getMLIntent(query);
//     let intents = intentString ? intentString.split("+").map(s => s.trim()) : [];
//     if (faqAnswer && !intents.includes("LIBRARY_INFO")) intents.push("LIBRARY_INFO");

//     // ── 6. Hybrid intent boost ────────────────────────────────────────────────
//     if (/\b(where (is|are|can)|locate|which shelf|which section|location of)\b/.test(q) &&
//         !intents.includes("LOCATE_BOOK")) intents.push("LOCATE_BOOK");
//     if (/\b(find|search|book|books|look for|any books|what books)\b/.test(q) &&
//         !intents.includes("FIND_BOOK")) intents.push("FIND_BOOK");

//     // ── 7. Keywords ───────────────────────────────────────────────────────────
//     const keywords = extractKeywords(query);



//     const allGibberish =
//       keywords.length > 0 && keywords.every(looksLikeGibberish);

//     if (keywords.length === 0 || allGibberish) {
//       return res.json({ success: true, intent: ["GENERAL_HELP"], data: {
//         answer:
//           `🤔 I didn't quite catch that. Try asking me something like:\n\n` +
//           `• "Find books on 'law'"\n` +
//           `• "Where can I find "engineering" books?"\n` +
//           `• "How do I borrow a book?"`,
//         books: [], recommendations: []
//       }});
//     }

//     if (keywords.length === 0) intents = ["GENERAL_HELP"];

//     // ── 8. User history + recommendations ────────────────────────────────────
//     let recommendations = [];
//     if (user) {
//       user.search_history = user.search_history || [];
//       user.search_history.push({ query, timestamp: new Date() });
//       await user.save();
//       const hq = user.search_history.map(i => i.query);
//       recommendations = await Book.find({ subjects: { $in: hq } }).limit(5);
//     }

//     // ── 9. Book search ────────────────────────────────────────────────────────
//     let books = [];

//     if (intents.includes("FIND_BOOK") || intents.includes("RECOMMEND_BOOK")) {
//       try { books = await semanticSearch(query); } catch { books = []; }

//       if ((!books || books.length === 0) && keywords.length > 0) {
//         const conds = keywords.map(word => ({
//           $or: [
//             { title:       { $regex: word, $options: "i" } },
//             { subjects:    { $regex: word, $options: "i" } },
//             { main_author: { $regex: word, $options: "i" } },
//             { notes:       { $regex: word, $options: "i" } }
//           ]
//         }));
//         books = await Book.find({ $and: conds }).limit(20);
//         if (books.length === 0) books = await Book.find({ $or: conds }).limit(20);

//         const scored = books.map(book => {
//           let score = 0;
//           keywords.forEach(word => {
//             const rx = new RegExp(word, "i");
//             if (rx.test(book.title))                   score += 6;
//             if (book.subjects?.some(s => rx.test(s))) score += 5;
//             if (rx.test(book.main_author))             score += 3;
//             if (rx.test(book.notes))                   score += 1;
//           });
//           return { book, score };
//         });
//         scored.sort((a, b) => b.score - a.score);
//         books = scored.filter(i => i.score > 0).map(i => i.book).slice(0, 5);
//       }
//     }

//     // Annotate with navigation
//     if (intents.includes("LOCATE_BOOK") && books.length > 0) {
//       books = books.map(book => {
//         const b = book.toObject ? book.toObject() : { ...book };
//         return { ...b, navigation: explainCallNumber(b.call_number),
//           location_note: `📍 Call Number: ${b.call_number}` };
//       });
//     }

//     // Pure locate — specific title
//     if (intents.includes("LOCATE_BOOK") && !intents.includes("FIND_BOOK")) {
//       const book = await Book.findOne({ title: { $regex: keywords.join("|"), $options: "i" } });
//       if (!book) return res.json({ success: false, intent: intents,
//         message: "❌ Book not found. Try a more specific title." });
//       return res.json({ success: true, intent: intents, data: {
//         answer: `📍 Here is where to find "${book.title}":`,
//         ...book.toObject(),
//         navigation: explainCallNumber(book.call_number),
//         location_note: `📍 Call Number: ${b.call_number ?? "Not yet catalogued"}`,
//         books: [], recommendations: []
//       }});
//     }

//     // Persist user state
//     if (user) {
//       user.lastQuery = query;
//       user.lastBooks = books.map(b => b.title);
//       await user.save();
//     }

//     // ── 10. Build base answer ─────────────────────────────────────────────────
//     const parts = [];

//     if (books.length > 0)
//       parts.push(`📚 Found ${books.length} relevant resource${books.length > 1 ? "s" : ""} for your query.`);

//     if (intents.includes("LIBRARY_INFO") && faqAnswer) {
//       let block = `ℹ️ ${faqAnswer}`;
//       if (faqTips.length) block += "\n\n💡 Tips:\n" + faqTips.map(t => `- ${t}`).join("\n");
//       parts.push(block);
//     }

//     if (locationResponse) parts.push(locationResponse);

//     if (recommendations.length > 0 && books.length === 0)
//       parts.push("🎯 Based on your search history, you might also like the books below.");

//     // ── 11. LLM enrichment ───────────────────────────────────────────────────
//     const useLLM = shouldUseLLM({ books, faqAnswer, intents, query });

//     if (useLLM) {
//       const llmAnswer = await askLLM(query, { books, faqAnswer, locationResponse, intents });

//       if (llmAnswer) {
//         if (parts.length > 0) {
//           // Catalogue results exist — LLM adds context
//           parts.push(`\n🤖 AI Assistant:\n${llmAnswer}`);
//         } else {
//           // LLM is the only answer
//           parts.push(`🤖 ${llmAnswer}`);
//           if (books.length === 0) {
//             parts.push(
//               `\n🌐 Open Access Resources:\n` +
//               OPEN_ACCESS_LINKS.map((l, i) => `${i + 1}. ${l.title}\n   ${l.url}`).join("\n")
//             );
//           }
//         }
//       } else if (parts.length === 0) {
//         // LLM failed + no other data — static open-access fallback
//         parts.push(
//           `❌ I could not find relevant resources in the physical library collection.\n\n` +
//           `🌐 You may try these Open Access Resources:\n` +
//           OPEN_ACCESS_LINKS.map((l, i) => `${i + 1}. ${l.title}\n   ${l.url}`).join("\n") +
//           `\n\n💡 You can also try:\n• Searching with a broader keyword\n• Using a different subject term\n• Searching by author name`
//         );
//       }
//     } else if (parts.length === 0) {
//       parts.push(
//         `❌ No relevant resources found. Try:\n\n` +
//         `• "Find books on engineering"\n• "Where are law books?"\n• "How do I borrow a book?"`
//       );
//     }

//     const answer = parts.join("\n\n");

//     // ── 12. Log + respond ─────────────────────────────────────────────────────
//     await Log.create({ type: "AI", user: req.user?._id, query, intent: intents,
//       response: answer, success: true, responseTime: Date.now() - startTime });

//     return res.json({
//       success: true, intent: intents,
//       data: {
//         answer,
//         books:           books           || [],
//         recommendations: recommendations || [],
//         openAccessLinks: books.length === 0 ? OPEN_ACCESS_LINKS : [],
//       }
//     });

//   } catch (error) {
//     console.error("AI Error:", error);
//     await Log.create({ type: "AI", user: req.user?._id, query: req.body?.query,
//       intent: [], response: error.message, success: false,
//       responseTime: Date.now() - startTime });
//     return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
//   }
// };

// import Book from "../models/book.js";
// import { extractKeywords } from "../utils/keywordExtractor.js";
// import { explainCallNumber } from "../utils/callNumberExplainer.js";
// import { getMLIntent, semanticSearch } from "../services/mlService.js";
// import { findResourceLocation, formatLocationResponse } from "../utils/resourceResolver.js";
// import User from "../models/user.js";
// import { findFAQResponse } from "../utils/faqResolver.js";
// import Log from "../models/log.js";
// import { handleConversation } from "../utils/conversation.js";


// const OPEN_ACCESS_LINKS = [
//   {
//     title: "UNIJOS Open Access Resources",
//     url: "https://www.unijos.edu.ng/open-access-resources",
//   },
//   {
//     title: "UNIJOS Library E-books",
//     url: "https://www.unijos.edu.ng/library_ebooks",
//   },
// ];

// export const askAI = async (req, res) => {
//   const startTime = Date.now();

//   try {
//     const { query } = req.body;
//     const q = query.toLowerCase();

//      // STEP 1: Detect resource location (DO NOT RETURN EARLY)
//     const locationMatches = findResourceLocation(query);
//     const locationResponse = formatLocationResponse(locationMatches);

//     if (
//   locationResponse &&
//   (
//     q.includes("library") ||
//     q.includes("location") ||
//     q.includes("where") ||
//     q.includes("uj") ||
//     q.includes("campus")
//   )
// ) {
//   return res.json({
//     success: true,
//     intent: ["LOCATION_INFO"],
//     message: "Library locations",
//     data: {
//       answer: locationResponse,
//       books: [],
//       recommendations: []
//     }
//   });
// }

//         // STEP 2: ML INTENT
//     let intentString = await getMLIntent(query);
//     let intents = intentString ? intentString.split("+") : [];

//     let sections = [];

//    if (!query) {
//   await Log.create({
//     type: "AI",
//     user: req.user?._id,
//     query: null,
//     intent: [],
//     response: "Query is required",
//     success: false
//   });

//   return res.status(400).json({ message: "Query is required" });
// }

//    let user = null;
// let recommendations = [];
//    const faqResult = findFAQResponse(query);
//    let faqAnswer = null;
//     let faqTips = [];

//     if (faqResult) {
//       if (typeof faqResult === "string") {
//         faqAnswer = faqResult; // from libraryFAQ.json
//       } else {
//         faqAnswer = faqResult.answer; // from expertKnowledge.json
//         faqTips = faqResult.tips || [];
//       }
//     }

// if (req.user?.id) {
//   user = await User.findById(req.user.id);

  

//         // FAQ / LIBRARY INFO CHECK
//         // 🔹 FAQ
 

//     if (faqAnswer && !/(book|find|locate|where)/.test(q)) {

//        let answer = `ℹ️ ${faqAnswer}`;

//       if (faqTips.length) {
//         answer += "\n\n💡 Tips:\n" + faqTips.map(t => `- ${t}`).join("\n");
//       }

//       await Log.create({
//       type: "AI",
//       user: req.user?._id,
//       query,
//       intent: ["LIBRARY_INFO"],
//       response: answer,
//       success: true,
//       responseTime: Date.now() - startTime
//     });
//       return res.json({
//         success: true,
//         intent: ["LIBRARY_INFO"],
//         message: "Library information response",
//        data: { answer, books: [], recommendations: [] }
//       });
//     }




//     if (faqAnswer && !intents.includes("LIBRARY_INFO")) {
//       intents.push("LIBRARY_INFO");
//     }

    

//     // 🧠 ================= CONVERSATION LAYER =================
//     const hour = new Date().getHours();
//     let greeting = "Hello";
//     if (hour < 12) greeting = "Good morning";
//     else if (hour < 17) greeting = "Good afternoon";
//     else greeting = "Good evening";

//     if (/(hi|hello|hey|good morning|good afternoon|good evening|who are you)/.test(q)) {
//       return res.json({
//         success: true,
//         intent: ["GREETING"],
//         data: {
//           answer: `👋 ${greeting }, ${user.name}! I'm your University of Jos AI virtual library assistant.\n\nHow may I assist you today?`,
//           books: [],
//           recommendations: []
//         }
//       });
//     }

//     if (/(what can you do|help me)/.test(q)) {
//       return res.json({
//         success: true,
//         intent: ["SMALL_TALK"],
//         data: {
//           answer: `😊 I can help you:\n\n• Find books\n• Recommend resources\n• Show where books are located in the University of jos library\n\nTry: "Find books on programming"`,
//           books: [],
//           recommendations: []
//         }
//       });
//     }

//     if (user) {
//         user.search_history.push({
//           query,
//           timestamp: new Date()
//         });
//         await user.save();

//         const historyQueries = user.search_history.map(item => item.query);

//         recommendations = await Book.find({
//           subjects: { $in: historyQueries }
//         }).limit(5);
//       }
    


//     // 🔥 STEP 3: HYBRID INTENT BOOST
//     if (
//       (q.includes("where") || q.includes("locate") || q.includes("find where")) &&
//       !intents.includes("LOCATE_BOOK")
//     ) {
//       intents.push("LOCATE_BOOK");
//     }

//     if (
//       (q.includes("find") || q.includes("book") || q.includes("books")) &&
//       !intents.includes("FIND_BOOK")
//     ) {
//       intents.push("FIND_BOOK");
//     }

//     // 🔍 STEP 4: KEYWORDS
//     const keywords = extractKeywords(query);

//     // 🔥 BLOCK BAD QUERIES
//     if (keywords.length === 0) {
//       return res.json({
//         success: false,
//         message:
//           "🤔 Your query is too vague. Try something like:\n\n• Find engineering books\n• Books on microbiology",
//       });
//     }

//     let books = [];

//     //  ================= FIND BOOK =================
//     if (intents.includes("FIND_BOOK")) {

//       //  1. SEMANTIC SEARCH
//       try {
//         books = await semanticSearch(query);
//       } catch (err) {
//         console.log("⚠️ Semantic search failed, falling back...");
//         books = [];
//       }

//       // 🔁 2. FALLBACK TO MONGODB SEARCH
//       if (!books || books.length === 0) {
//         const searchConditions = keywords.map(word => ({
//           $or: [
//             { title: { $regex: word, $options: "i" } },
//             { subjects: { $regex: word, $options: "i" } },
//             { main_author: { $regex: word, $options: "i" } },
//             { notes: { $regex: word, $options: "i" } }
//           ]
//         }));

//         // 🔹 strict match
//         books = await Book.find({ $and: searchConditions }).limit(20);

//         // 🔹 fallback loose match
//         if (books.length === 0) {
//           books = await Book.find({ $or: searchConditions }).limit(20);
//         }

//         // 🔥 relevance scoring
//         const scoredBooks = books.map(book => {
//           let score = 0;

//           keywords.forEach(word => {
//             const regex = new RegExp(word, "i");

//             if (regex.test(book.title)) score += 6;
//             if (book.subjects?.some(s => regex.test(s))) score += 5;
//             if (regex.test(book.main_author)) score += 3;
//             if (regex.test(book.notes)) score += 1;
//           });

//           return { book, score };
//         });

//         scoredBooks.sort((a, b) => b.score - a.score);

//         books = scoredBooks
//           .filter(item => item.score > 0)
//           .map(item => item.book)
//           .slice(0, 5);
//       }
//     }

//     // 📍 ================= LOCATE (WITH FIND) =================
//     if (intents.includes("LOCATE_BOOK") && books.length > 0) {
//       books = books.map(book => {
//         const bookObj = book.toObject ? book.toObject() : book;

//         return {
//           ...bookObj,
//           navigation: explainCallNumber(bookObj.call_number),
//           location_note: `📍 Call Number: ${bookObj.call_number}`
//         };
//       });
//     }

//     // 📍 ================= PURE LOCATE =================
//     if (
//       intents.includes("LOCATE_BOOK") &&
//       !intents.includes("FIND_BOOK")
//     ) {
//       const book = await Book.findOne({
//         title: { $regex: keywords.join(" "), $options: "i" }
//       });

//       if (!book) {
//         return res.json({
//           success: false,
//           intent: intents,
//           message: "❌ Book not found. Try a more specific title."
//         });
//       }

//       return res.json({
//         success: true,
//         intent: intents,
//         message: `📍 Location guide for "${book.title}"`,
//         data: {
//           ...book.toObject(),
//           navigation: explainCallNumber(book.call_number),
//           location_note: `📍 Call Number: ${book.call_number}`
//         }
//       });
//     }

//     if (user) {
//       user.lastQuery = query;
//       user.lastBooks = books.map(b => b.title);
//       user.search_history.push({ query, timestamp: new Date() });
//       await user.save();
//     }

//     // 🔹 FOLLOW-UP FIX
//     if (q.includes("where is it") && user?.lastBooks?.length) {
//       const book = await Book.findOne({
//         title: { $regex: user.lastBooks[0], $options: "i" },
//       });

//       if (book) {
//         return res.json({
//           success: true,
//           intent: ["LOCATE_BOOK"],
//           data: {
//             answer: `📍 Here is where to find "${book.title}":`,
//             navigation: explainCallNumber(book.call_number),
//           },
//         });
//       }
//     }

//     // 📚 ================= RECOMMEND =================
//     if (intents.includes("RECOMMEND_BOOK")) {
//       const recommended = await Book.find().limit(5);

//       return res.json({
//         success: true,
//         intent: intents,
//         message: "📚 Here are some recommended books",
//         data: {
//                   answer: "📚 Here are some recommended books",
//                   books: recommended,
//                   recommendations: recommended
//                 }
//      });
//     }

//     // 🔥 ================= FINAL HYBRID RESPONSE =================
  

// let answer = "";

// //  Books summary
// if (books && books.length > 0) {
//   answer = `📚 Found ${books.length} relevant resources for your query.`;
// }

// //  Location info
// if (locationResponse) {
//   sections.push(locationResponse);
// }

// //  FAQ
// if (intents.includes("LIBRARY_INFO") && faqAnswer) {
//   sections.push(`ℹ️ ${faqAnswer}`);
// }

// //  Recommendations
// if (recommendations.length > 0) {
//   sections.push("🎯 Recommended books available below.");
// }

// // ❌ fallback
// if (!answer) {

//   answer =
// `❌ I could not find relevant resources in the physical library collection.

// 🌐 You may try these Open Access Resources:

// 1. UNIJOS Open Access Resources
// https://www.unijos.edu.ng/open-access-resources

// 2. UNIJOS Library E-books
// https://www.unijos.edu.ng/library_ebooks

// 💡 You can also try:
// • searching with a broader keyword
// • using a different subject term
// • searching by author name`;
// }

//     const responseTime = Date.now() - startTime;

//     await Log.create({
//       type: "AI",
//       user: req.user?._id,
//       query,
//       intent: intents,
//       response: answer,
//       success: true,
//       responseTime
//     });

//       return res.json({
//       success: true,
//       intent: intents,
//       data: {
//         answer: answer || "",
//         books: books || [],
//         recommendations: recommendations || [],
//          openAccessLinks: books.length === 0 ? OPEN_ACCESS_LINKS : [],
//       }
//     });

//   }}catch (error) {
//   console.error("AI Error:", error);

//   await Log.create({
//     type: "AI",
//     user: req.user?._id,
//     query: req.body?.query,
//     intent: [],
//     response: error.message,
//     success: false,
//     responseTime: Date.now() - startTime
//   });

//   return res.status(500).json({
//     success: false,
//     message: "Internal server error",
//     error: error.message
//   });
// }
// };

// // import Book from "../models/book.js";
// // import { extractKeywords } from "../utils/keywordExtractor.js";
// // import { explainCallNumber } from "../utils/callNumberExplainer.js";
// // import { getMLIntent, semanticSearch } from "../services/mlService.js";
// // import { findResourceLocation, formatLocationResponse } from "../utils/resourceResolver.js";

// // export const askAI = async (req, res) => {
// //   try {
// //     const { query } = req.body;


// //     if (!query) {
// //       return res.status(400).json({ message: "Query is required" });
// //     }

// //     // Detect resource location (DO NOT RETURN EARLY)
// //     const locationMatches = findResourceLocation(query);
// //     const locationResponse = formatLocationResponse(locationMatches);

// //     // STEP 1: ML INTENT
// //     let intentString = await getMLIntent(query);
// //     let intents = intentString ? intentString.split("+") : [];

// //     const q = query.toLowerCase();

// //     //  STEP 2: HYBRID INTENT BOOST (VERY IMPORTANT)
// //     if (
// //       (q.includes("where") || q.includes("locate") || q.includes("find where")) &&
// //       !intents.includes("LOCATE_BOOK")
// //     ) {
// //       intents.push("LOCATE_BOOK");
// //     }

// //     if (
// //       (q.includes("find") || q.includes("book") || q.includes("books")) &&
// //       !intents.includes("FIND_BOOK")
// //     ) {
// //       intents.push("FIND_BOOK");
// //     }

// //     // 🔍 STEP 3: KEYWORDS
// //     const keywords = extractKeywords(query);

// //     let books = [];

// //     // 🔥 ================= FIND BOOK (SEMANTIC FIRST) =================
// //     if (intents.includes("FIND_BOOK")) {

// //       // 🧠 1. SEMANTIC SEARCH (PRIMARY)
// //       try {
// //         books = await semanticSearch(query);
// //       } catch (err) {
// //         console.log("⚠️ Semantic search failed, falling back...");
// //         books = [];
// //       }

// //       // 🔁 2. FALLBACK TO MONGODB SEARCH
// //       if (!books || books.length === 0) {
// //         const searchConditions = keywords.map(word => ({
// //           $or: [
// //             { title: { $regex: word, $options: "i" } },
// //             { subjects: { $regex: word, $options: "i" } },
// //             { main_author: { $regex: word, $options: "i" } },
// //             { notes: { $regex: word, $options: "i" } }
// //           ]
// //         }));

// //         // 🔹 Try strict match
// //         books = await Book.find({ $and: searchConditions }).limit(20);

// //         // 🔹 fallback to loose match
// //         if (books.length === 0) {
// //           books = await Book.find({ $or: searchConditions }).limit(20);
// //         }

// //         // 🔥 RELEVANCE SCORING
// //         const scoredBooks = books.map(book => {
// //           let score = 0;

// //           keywords.forEach(word => {
// //             const regex = new RegExp(word, "i");

// //             if (regex.test(book.title)) score += 6;
// //             if (book.subjects?.some(s => regex.test(s))) score += 5;
// //             if (regex.test(book.main_author)) score += 3;
// //             if (regex.test(book.notes)) score += 1;
// //           });

// //           return { book, score };
// //         });

// //         scoredBooks.sort((a, b) => b.score - a.score);

// //         books = scoredBooks
// //           .filter(item => item.score > 0)
// //           .map(item => item.book)
// //           .slice(0, 5);
// //       }
// //     }

// //     // 📍 ================= LOCATE (WITH FIND) =================
// //     if (intents.includes("LOCATE_BOOK") && books.length > 0) {
// //       books = books.map(book => {
// //         const bookObj = book.toObject ? book.toObject() : book;

// //         return {
// //           ...bookObj,
// //           navigation: explainCallNumber(bookObj.call_number),
// //           location_note: `📍 Call Number: ${bookObj.call_number}`
// //         };
// //       });
// //     }

// //     // 📍 ================= PURE LOCATE =================
// //     if (
// //       intents.includes("LOCATE_BOOK") &&
// //       !intents.includes("FIND_BOOK")
// //     ) {
// //       const book = await Book.findOne({
// //         title: { $regex: keywords.join(" "), $options: "i" }
// //       });

// //       if (!book) {
// //         return res.json({
// //           intent: intents,
// //           message: "❌ Book not found. Try a more specific title."
// //         });
// //       }

// //       return res.json({
// //         intent: intents,
// //         message: `📍 Location guide for "${book.title}"`,
// //         data: {
// //           ...book.toObject(),
// //           navigation: explainCallNumber(book.call_number),
// //           location_note: `📍 Call Number: ${book.call_number}`
// //         }
// //       });
// //     }

// //     // 📚 ================= RECOMMEND =================
// //     if (intents.includes("RECOMMEND_BOOK")) {
// //       const recommended = await Book.find().limit(5);

// //       return res.json({
// //         intent: intents,
// //         message: "📚 Here are some recommended books",
// //         data: recommended
// //       });
// //     }

// //     // 🔥 ================= FINAL RESPONSE =================
// //     if (books.length > 0) {
// //       return res.json({
// //         intent: intents,
// //         message: intents.includes("LOCATE_BOOK")
// //           ? "📍 Here are books and where to find them"
// //           : `📚 Here are books related to "${query}"`,
// //         data: books
// //       });
// //     }

// //     // 💬 ================= FALLBACK =================
// //     return res.json({
// //       intent: intents,
// //       message:
// //         "🤖 I couldn't find relevant results. Try keywords like 'law', 'medicine', or 'engineering'."
// //     });

// //   } catch (error) {
// //     console.error("AI Controller Error:", error);
// //     res.status(500).json({ error: error.message });
// //   }
// // };




// // import Book from "../models/book.js";
// // import { extractKeywords } from "../utils/keywordExtractor.js";
// // import { explainCallNumber } from "../utils/callNumberExplainer.js";
// // import { getMLIntent } from "../services/mlService.js";
// // import { semanticSearch } from "../services/mlService.js";

// // export const askAI = async (req, res) => {
// //   try {
// //     const { query } = req.body;

// //     if (!query) {
// //       return res.status(400).json({ message: "Query is required" });
// //     }

// //     // 🔥 STEP 1: ML INTENT
// //     let intentString = await getMLIntent(query);
// //     let intents = intentString ? intentString.split("+") : [];

// //     const q = query.toLowerCase();

// //     // 🔥 STEP 2: HYBRID INTENT BOOST (CRITICAL FIX)
// //     if (
// //       (q.includes("where") || q.includes("locate") || q.includes("shelf")) &&
// //       !intents.includes("LOCATE_BOOK")
// //     ) {
// //       intents.push("LOCATE_BOOK");
// //     }

// //     if (
// //       (q.includes("find") || q.includes("book") || q.includes("books")) &&
// //       !intents.includes("FIND_BOOK")
// //     ) {
// //       intents.push("FIND_BOOK");
// //     }

// //     // 🔍 STEP 3: KEYWORDS
// //     const keywords = extractKeywords(query);

// //     let books = [];

// //     // 🔍 ================= FIND BOOK =================
// //     if (intents.includes("FIND_BOOK")) {
// //       const searchConditions = keywords.map(word => ({
// //         $or: [
// //           { title: { $regex: word, $options: "i" } },
// //           { subjects: { $regex: word, $options: "i" } },
// //           { main_author: { $regex: word, $options: "i" } },
// //           { notes: { $regex: word, $options: "i" } }
// //         ]
// //       }));

// //       // 🔹 STRICT MATCH
// //       books = await Book.find({ $and: searchConditions }).limit(20);

// //       // 🔹 FALLBACK
// //       if (books.length === 0) {
// //         books = await Book.find({ $or: searchConditions }).limit(20);
// //       }

// //       // 🔥 SCORING
// //       const scoredBooks = books.map(book => {
// //         let score = 0;

// //         keywords.forEach(word => {
// //           const regex = new RegExp(word, "i");

// //           if (regex.test(book.title)) score += 6;
// //           if (book.subjects?.some(s => regex.test(s))) score += 5;
// //           if (regex.test(book.main_author)) score += 3;
// //           if (regex.test(book.notes)) score += 1;
// //         });

// //         return { book, score };
// //       });

// //       scoredBooks.sort((a, b) => b.score - a.score);

// //       books = scoredBooks
// //         .filter(item => item.score > 0)
// //         .map(item => item.book)
// //         .slice(0, 5);
// //     }

// //     // 📍 ================= LOCATE (WITH FIND) =================
// //     if (intents.includes("LOCATE_BOOK") && books.length > 0) {
// //       books = books.map(book => ({
// //         ...book.toObject(),
// //         navigation: explainCallNumber(book.call_number)
// //       }));
// //     }

// //     // 📍 ================= PURE LOCATE =================
// //     if (
// //       intents.includes("LOCATE_BOOK") &&
// //       !intents.includes("FIND_BOOK")
// //     ) {
// //       const book = await Book.findOne({
// //         title: { $regex: keywords.join(" "), $options: "i" }
// //       });

// //       if (!book) {
// //         return res.json({
// //           intent: intents,
// //           message: "❌ Book not found. Try a more specific title."
// //         });
// //       }

// //       return res.json({
// //         intent: intents,
// //         message: `📍 Location guide for "${book.title}"`,
// //         data: {
// //           ...book.toObject(),
// //           navigation: explainCallNumber(book.call_number)
// //         }
// //       });
// //     }

// //     // 📚 ================= RECOMMEND =================
// //     if (intents.includes("RECOMMEND_BOOK")) {
// //       const recommended = await Book.find().limit(5);

// //       return res.json({
// //         intent: intents,
// //         message: "📚 Here are some recommended books",
// //         data: recommended
// //       });
// //     }

// //     // 🔥 ================= FINAL RESPONSE =================
// //     if (books.length > 0) {
// //       return res.json({
// //         intent: intents,
// //         message: intents.includes("LOCATE_BOOK")
// //           ? "📍 Here are books and where to find them"
// //           : `📚 Here are books related to "${query}"`, // ✅ better UX
// //         data: books
// //       });
// //     }

// //     // 💬 ================= FALLBACK =================
// //     return res.json({
// //       intent: intents,
// //       message:
// //         "🤖 I couldn't find relevant results. Try keywords like 'law', 'medicine', or 'engineering'."
// //     });

// //   } catch (error) {
// //     console.error("AI Controller Error:", error);
// //     res.status(500).json({ error: error.message });
// //   }
// // };



// // import Book from "../models/book.js";
// // import { detectIntent } from "../utils/intentClassifier.js";
// // import { extractKeywords } from "../utils/keywordExtractor.js";
// // import { explainCallNumber } from "../utils/callNumberExplainer.js";

// // export const askAI = async (req, res) => {
// //   try {
// //     const { query } = req.body;

// //     // 🔥 MULTI-INTENT SUPPORT
// //     const intents = detectIntent(query); // now returns ARRAY
// //     const keywords = extractKeywords(query);

// //     let books = [];

// //     // 🔍 ================= FIND BOOK =================
// //     if (intents.includes("FIND_BOOK")) {
// //       const searchConditions = keywords.map(word => ({
// //         $or: [
// //           { title: { $regex: word, $options: "i" } },
// //           { subjects: { $regex: word, $options: "i" } },
// //           { main_author: { $regex: word, $options: "i" } },
// //           { notes: { $regex: word, $options: "i" } }
// //         ]
// //       }));

// //       // 🔹 STRICT MATCH (AND)
// //       books = await Book.find({
// //         $and: searchConditions
// //       }).limit(15);

// //       // 🔹 FALLBACK (OR)
// //       if (books.length === 0) {
// //         books = await Book.find({
// //           $or: searchConditions
// //         }).limit(15);
// //       }

// //       // 🔥 RELEVANCE SCORING
// //       const scoredBooks = books.map(book => {
// //         let score = 0;

// //         keywords.forEach(word => {
// //           const regex = new RegExp(word, "i");

// //           if (regex.test(book.title)) score += 6; // highest
// //           if (book.subjects?.some(s => regex.test(s))) score += 5;
// //           if (regex.test(book.main_author)) score += 3;
// //           if (regex.test(book.notes)) score += 1;
// //         });

// //         return { book, score };
// //       });

// //       // 🔹 SORT BY SCORE
// //       scoredBooks.sort((a, b) => b.score - a.score);

// //       // 🔹 TAKE TOP RESULTS
// //       books = scoredBooks.map(item => item.book).slice(0, 5);
// //     }

// //     // 📍 ================= LOCATE (ENHANCED) =================
// //     if (intents.includes("LOCATE_BOOK") && books.length > 0) {
// //       books = books.map(book => ({
// //         ...book.toObject(),
// //         navigation: explainCallNumber(book.call_number)
// //       }));
// //     }

// //     // 📍 ================= PURE LOCATE (NO FIND) =================
// //     if (
// //       intents.includes("LOCATE_BOOK") &&
// //       !intents.includes("FIND_BOOK")
// //     ) {
// //       const book = await Book.findOne({
// //         title: { $regex: keywords.join(" "), $options: "i" }
// //       });

// //       if (!book) {
// //         return res.json({
// //           intent: intents,
// //           message: "❌ Book not found. Try a more specific title."
// //         });
// //       }

// //       return res.json({
// //         intent: intents,
// //         message: `📍 Location guide for "${book.title}"`,
// //         data: {
// //           ...book.toObject(),
// //           navigation: explainCallNumber(book.call_number)
// //         }
// //       });
// //     }

// //     // 📚 ================= RECOMMEND =================
// //     if (intents.includes("RECOMMEND_BOOK")) {
// //       const recommended = await Book.find().limit(5);

// //       return res.json({
// //         intent: intents,
// //         message: "📚 Here are some recommended books",
// //         data: recommended
// //       });
// //     }

// //     // 🔥 ================= FINAL RESPONSE =================
// //     if (books.length > 0) {
// //       return res.json({
// //         intent: intents,
// //         message: intents.includes("LOCATE_BOOK")
// //           ? `📍 Here are books and where to find them`
// //           : `📚 Here are books related to "${keywords.join(" ")}"`,
// //         data: books
// //       });
// //     }

// //     // 💬 ================= FALLBACK =================
// //     return res.json({
// //       intent: intents,
// //       message:
// //         "🤖 I couldn't find exact matches. Try different keywords like 'law', 'medicine', or 'engineering'."
// //     });

// //   } catch (error) {
// //     res.status(500).json({ error: error.message });
// //   }
// // };