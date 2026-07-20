import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resourceMap = JSON.parse(
  fs.readFileSync(path.join(__dirname, "resourceLocation.json"), "utf-8")
);

/**
 * Aliases map user-typed words → faculty keys in resourceLocation.json
 * Add more as needed.
 */
const FACULTY_ALIASES = {
  // Engineering
  "engineering":        "Engineering",
  "mechanical":         "Engineering",
  "electrical":         "Engineering",
  "civil":              "Engineering",
  "computer engineering": "Engineering",

  // Law
  "law":                "Law",
  "legal":              "Law",
  "constitutional":     "Law",
  "criminal law":       "Law",

  // Medical / Health
  "medicine":           "Medical Science",
  "medical":            "Medical Science",
  "anatomy":            "Medical Science",
  "physiology":         "Medical Science",
  "microbiology":       "Medical Science",
  "health":             "Health Science",
  "health science":     "Health Science",
  "nursing":            "Health Science",
  "clinical":           "Clinical Science",
  "surgery":            "Clinical Science",
  "juth":               "Clinical Science",

  // Pharmacy / Dental
  "pharmacy":           "Pharmaceutical Science",
  "pharmaceutical":     "Pharmaceutical Science",
  "pharmacology":       "Pharmaceutical Science",
  "dentistry":          "Dental Science",
  "dental":             "Dental Science",

  // Natural Science
  "science":            "Natural Science",
  "physics":            "Natural Science",
  "chemistry":          "Natural Science",
  "biology":            "Natural Science",
  "mathematics":        "Natural Science",
  "maths":              "Natural Science",
  "math":               "Natural Science",
  "statistics":         "Natural Science",
  "geology":            "Natural Science",
  "biochemistry":       "Natural Science",

  // Social Science
  "social":             "Social Science",
  "sociology":          "Social Science",
  "psychology":         "Social Science",
  "political science":  "Social Science",
  "economics":          "Social Science",
  "geography":          "Social Science",

  // Management
  "management":         "Management Science",
  "business":           "Management Science",
  "accounting":         "Management Science",
  "finance":            "Management Science",
  "banking":            "Management Science",
  "marketing":          "Management Science",

  // Agriculture / Vet
  "agriculture":        "Agricultural Science",
  "agricultural":       "Agricultural Science",
  "agronomy":           "Agricultural Science",
  "veterinary":         "Veterinary Medicine",
  "vet":                "Veterinary Medicine",
  "animal science":     "Veterinary Medicine",

  // Education
  "education":          "Education",
  "teaching":           "Education",
  "pedagogy":           "Education",

  // Arts
  "art":                "Art",
  "arts":               "Art",
  "language":           "Art",
  "literature":         "Art",
  "history":            "Art",
  "linguistics":        "Art",
  "music":              "Art",
  "theatre":            "Art",
  "philosophy":         "Art",

  // Environmental
  "environment":        "Environmental Science",
  "environmental":      "Environmental Science",
  "ecology":            "Environmental Science",
  "urban planning":     "Environmental Science",
  "architecture":       "Environmental Science",
};

/**
 * Find which faculties/locations match the user's query.
 * Returns an array of { faculty, location } objects, or null if no match.
 */
export const findResourceLocation = (query) => {
  if (!query) return null;

  const q = query.toLowerCase();
  const matched = new Map(); // faculty → location (deduplicate)

  // 1. Check multi-word aliases first (longest match wins)
  const sortedAliases = Object.entries(FACULTY_ALIASES).sort(
    ([a], [b]) => b.length - a.length          // longest phrase first
  );

  for (const [alias, faculty] of sortedAliases) {
    if (q.includes(alias) && !matched.has(faculty)) {
      matched.set(faculty, resourceMap[faculty]);
    }
  }

  // 2. Also do a direct faculty-name check (catches "Natural Science" typed verbatim)
  for (const faculty of Object.keys(resourceMap)) {
    if (q.includes(faculty.toLowerCase()) && !matched.has(faculty)) {
      matched.set(faculty, resourceMap[faculty]);
    }
  }

  if (matched.size === 0) return null;

  return Array.from(matched.entries()).map(([faculty, location]) => ({
    faculty,
    location,
  }));
};

/**
 * Format matched faculties into a human-readable string.
 */
export const formatLocationResponse = (matches) => {
  if (!matches || matches.length === 0) return null;

  const lines = matches.map(({ faculty, location }) => {
    if (!location) return `• ${faculty}: (location not set)`;   // 👈 no more undefined
    if (Array.isArray(location))
      return `• ${faculty}:\n` + location.map(l => `   - ${l}`).join("\n");
    return `• ${faculty}: ${location}`;
  });

  return "📍 Library Locations:\n\n" + lines.join("\n");
};


/**
 * Given a campus/library name mentioned in a query, return which faculties
 * it serves. Used to give the LLM real context instead of letting it guess.
 */
export const getFacultiesForCampus = (query) => {
  if (!query) return [];
  const q = query.toLowerCase();

  const campusAliases = {
    "naraguta": "Naraguta Campus Library",
    "bauchi":   "Bauchi Road Campus Library",
    "juth":     "JUTH Library",
    "law":      "Faculty of Law Library",
  };

  const matchedCampus = Object.entries(campusAliases).find(([alias]) => q.includes(alias));
  if (!matchedCampus) return [];

  const [, campusName] = matchedCampus;

  return Object.entries(resourceMap)
    .filter(([, location]) => {
      const locs = Array.isArray(location) ? location : [location];
      return locs.includes(campusName);
    })
    .map(([faculty]) => faculty);
};