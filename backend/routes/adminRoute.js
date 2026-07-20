import express from "express";
import {
  getUsers,
  deleteUser,
  getStats,
  getLogs,
  getPerformance,
  uploadBooks,
   getOverview,
  getTopQueries,
  getIntentStats,
  getFailures,
  getDailyUsage,
  getAuthStats
} from "../controllers/adminController.js";

import { protect, adminOnly } from "../middleware/auth.js";

const router = express.Router();

// 🔐 ALL ADMIN ROUTES PROTECTED
router.use(protect, adminOnly);

router.get("/users", getUsers);
router.delete("/users/:id", deleteUser);

router.get("/stats", getStats);
router.get("/logs", getLogs);
router.get("/performance", getPerformance);

router.post("/upload-books", uploadBooks);

router.get("/overview", getOverview);
router.get("/top-queries", getTopQueries);
router.get("/intents", getIntentStats);
router.get("/failures", getFailures);
router.get("/daily-usage", getDailyUsage);
router.get("/auth-stats", getAuthStats);

export default router;