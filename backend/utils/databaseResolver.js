import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databases = JSON.parse(
  fs.readFileSync(path.join(__dirname, "electronicDatabases.json"), "utf-8")
);

/**
 * Aliases map user-typed words → faculty tags used in electronicDatabases.json.
 * Deliberately overlaps with resourceResolver.js's FACULTY_ALIASES where subjects
 * match, but also includes "Computer Science" and "Law" as their own tags since
 * databases distinguish these more finely than the physical shelf location map does.
 */
const SUBJECT_ALIASES = {
  // Computer Science
  "computer science": "Computer Science",
  "computing":        "Computer Science",
  "programming":      "Computer Science",
  "software":         "Computer Science",

  // Engineering
  "engineering":        "Engineering",
  "mechanical":         "Engineering",
  "electrical":         "Engineering",
  "civil":              "Engineering",

  // Law
  "law":                "Law",
  "legal":              "Law",

  // Medical / Health / Clinical
  "medicine":           "Medical Science",
  "medical":            "Medical Science",
  "health":             "Health Science",
  "clinical":           "Clinical Science",
  "nursing":            "Health Science",

  // Natural Science
  "science":            "Natural Science",
  "physics":            "Natural Science",
  "chemistry":          "Natural Science",
  "biology":            "Natural Science",

  // Social Science / Arts
  "social":             "Social Science",
  "sociology":          "Social Science",
  "psychology":         "Social Science",
  "economics":          "Social Science",
  "history":            "Art",
  "literature":         "Art",
  "language":           "Art",

  // Management
  "management":         "Management Science",
  "business":           "Management Science",
  "economy":            "Management Science",
  "finance":             "Management Science",

  // Agriculture
  "agriculture":        "Agricultural Science",
  "agricultural":       "Agricultural Science",

  // Environmental
  "environment":        "Environmental Science",
  "environmental":      "Environmental Science",
};

/**
 * Find electronic databases relevant to a user's query.
 * Falls back to multidisciplinary databases if no specific subject matches,
 * so a generic "research databases" query still returns useful results.
 *
 * @param {string} query
 * @param {number} limit - max databases to return (default 3)
 * @returns {Array} matched database objects
 */
export const findRelevantDatabases = (query, limit = 3) => {
  if (!query) return [];

  const q = query.toLowerCase();
  let matchedFaculty = null;

  const sortedAliases = Object.entries(SUBJECT_ALIASES).sort(
    ([a], [b]) => b.length - a.length
  );

  for (const [alias, faculty] of sortedAliases) {
    if (q.includes(alias)) { matchedFaculty = faculty; break; }
  }

  let results;
  if (matchedFaculty) {
    results = databases.filter(db => db.faculties.includes(matchedFaculty));
    // Top up with multidisciplinary options if the specific-subject match is thin
    if (results.length < limit) {
      const extra = databases.filter(
        db => db.faculties.includes("Multidisciplinary") && !results.includes(db)
      );
      results = [...results, ...extra];
    }
  } else {
    results = databases.filter(db => db.faculties.includes("Multidisciplinary"));
  }

  return results.slice(0, limit);
};

/**
 * Return all databases — used for an explicit "list all databases" request.
 */
export const getAllDatabases = () => databases;
