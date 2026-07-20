import { sectionToFacultyMap } from "./sectionToFacultyMap.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load resource locations
const resourceMap = JSON.parse(
  fs.readFileSync(path.join(__dirname, "resourceLocation.json"), "utf-8")
);


export const explainCallNumber = (callNumber) => {
  if (!callNumber) return "No call number provided.";


  const code = callNumber.trim().toUpperCase();

 // 🔥 Extract ALL letter groups
const matches = code.match(/[A-Z]+/g);

// Remove unwanted prefixes like REF
const filtered = matches ? matches.filter(m => m !== "REF") : [];

// Use the first meaningful prefix
const prefix = filtered.length > 0 ? filtered[0] : "";

  const numberMatch = code.match(/\d+/);
  const number = numberMatch ? parseInt(numberMatch[0]) : null;

  // 🔹 Sections
  const mainSections = {
    K: "Law Section",
    Q: "Science Section",
    R: "Medical Section",
    H: "Social Sciences Section",
    T: "Technology Section",
    P: "Language & Literature Section"
  };

  const subSections = {
    TJ: "Mechanical Engineering Section",
    TK: "Electrical Engineering Section",
    TA: "Engineering Section",

    QA: "Mathematics Section",
    QC: "Physics Section",
    QD: "Chemistry Section",
    QH: "Biology Section",
    QR: "Microbiology Section",

    RC: "Clinical Medicine Section",
    QM: "Human Anatomy Section",

    KP: "Nigerian Law Section",
    KL: "Comparative Law Section",
    KF: "American Law Section"
  };

  // 🔥 Resolve Section
  let section = "General Section";

  const sortedPrefixes = Object.keys(subSections).sort((a, b) => b.length - a.length);

  for (const key of sortedPrefixes) {
    if (prefix.startsWith(key)) {
      section = subSections[key];
      break;
    }
  }

  if (section === "General Section") {
    section = mainSections[prefix[0]] || "General Section";
  }

  // 🔥 NEW: Resolve Faculty → Campus
  const faculty = sectionToFacultyMap[section];
  const location = faculty ? resourceMap[faculty] : null;

  let steps = [];

  // 📍 Campus first (NEW FEATURE)
  if (location) {
    if (Array.isArray(location)) {
      steps.push(`📍 This book may be available at:`);
      location.forEach(loc => {
        steps.push(`   - ${loc}`);
      });
    } else {
      steps.push(`📍 Go to ${location}`);
    }
  }

  // 📍 Section
  steps.push(`➡️ ${section}`);

  // 🔥 INSERT HERE (RIGHT AFTER SECTION)
const isReference = callNumber.toUpperCase().includes("REF");

if (isReference) {
  steps.push("📌 This is a Reference Book (Library use only)");
}

  // 📚 Shelf
  if (number !== null) {
    const rangeStart = Math.floor(number / 100) * 100;
    const rangeEnd = rangeStart + 99;

    steps.push(`📚 Shelf range: ${prefix}${rangeStart}–${prefix}${rangeEnd}`);
    steps.push(`🔢 Call Number: ${callNumber}`);
  }

  steps.push("✅ Books are arranged alphabetically and numerically.");

  steps.push("💡 Tip: If unsure, ask a librarian at the circulation desk.");

  return steps.join("\n");
};