// controllers/profileController.js
import User from "../models/user.js";
import { DEPARTMENTS, LEVELS, NIGERIAN_STATES, findDepartment } from "../utils/academicCatalog.js";
import { isProfileComplete, getSuggestions } from "../services/personalizationService.js";

const uid = (req) => req.user?.id || req.user?._id;

const shape = (user) => {
  const p = user.toObject().profile || {};
  return {
    department:    p.department    || "",
    faculty:       p.faculty       || "",
    course:        p.course        || "",
    level:         p.level         || "",
    dateOfBirth:   p.dateOfBirth ? new Date(p.dateOfBirth).toISOString().slice(0, 10) : "",
    stateOfOrigin: p.stateOfOrigin || "",
    completedAt:   p.completedAt   || null,
  };
};

const ageOf = (dob) => {
  const n = new Date();
  let a = n.getFullYear() - dob.getUTCFullYear();
  const m = n.getMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && n.getDate() < dob.getUTCDate())) a--;
  return a;
};

// GET /profile/options
export const getProfileOptions = (_req, res) => {
  const departments = DEPARTMENTS
    .map(({ name, faculty }) => ({ name, faculty }))
    .sort((a, b) => a.faculty.localeCompare(b.faculty) || a.name.localeCompare(b.name));
  res.json({ success: true, departments, levels: LEVELS, states: NIGERIAN_STATES });
};

// GET /profile
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(uid(req)).select("profile profileCompleted role name");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ success: true, profile: shape(user), profileCompleted: isProfileComplete(user.profile) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /profile
export const updateProfile = async (req, res) => {
  try {
    const { department, course, level, dateOfBirth, stateOfOrigin } = req.body || {};
    const errors = {};

    const dept = findDepartment(department);
    if (!dept) errors.department = "Please select a valid department";

    const c = String(course || "").trim();
    if (c.length < 2 || c.length > 100) errors.course = "Enter your course of study (2–100 characters)";

    if (!LEVELS.includes(level)) errors.level = "Please select your level";

    let dob = null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateOfBirth || ""))) errors.dateOfBirth = "Enter a valid date";
    else {
      dob = new Date(`${dateOfBirth}T00:00:00.000Z`);
      const age = isNaN(dob) ? -1 : ageOf(dob);
      if (age < 14 || age > 90) errors.dateOfBirth = "Please check your date of birth";
    }

    if (!NIGERIAN_STATES.includes(stateOfOrigin)) errors.stateOfOrigin = "Please select a state";

    if (Object.keys(errors).length)
      return res.status(400).json({ message: "Please correct the highlighted fields", errors });

    // $set on specific paths — doesn't rewrite the whole user doc (and its big conversations array)
    const user = await User.findByIdAndUpdate(
      uid(req),
      {
        $set: {
          "profile.department":    dept.name,
          "profile.faculty":       dept.faculty,
          "profile.course":        c,
          "profile.level":         level,
          "profile.dateOfBirth":   dob,
          "profile.stateOfOrigin": stateOfOrigin,
          "profile.completedAt":   new Date(),
          profileCompleted: true,
        },
      },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ success: true, profile: shape(user), profileCompleted: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /profile/suggestions
export const getProfileSuggestions = async (req, res) => {
  try {
    const user = await User.findById(uid(req)).select("profile search_history role name");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ success: true, suggestions: await getSuggestions(user, 6) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
