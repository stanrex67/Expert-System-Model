// routes/profileRoutes.js
import express from "express";
import { protect } from "../middleware/auth.js"; // ← use YOUR existing auth middleware name/path
import { getProfileOptions, getProfile, updateProfile, getProfileSuggestions } from "../controllers/profileController.js";

const router = express.Router();
router.get("/options",     protect, getProfileOptions);
router.get("/suggestions", protect, getProfileSuggestions);
router.get("/",            protect, getProfile);
router.put("/",            protect, updateProfile);
export default router;
