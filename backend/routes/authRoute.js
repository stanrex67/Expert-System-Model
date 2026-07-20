import express from "express";
import {
  register,
  login,
  verifyAccount,
  getMe,
  logout,
  forgotPassword,
  resetPassword,
  getConversation,
  getConversations,
  deleteConversation,
  clearConversations,
  deleteConversationMessage,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";

//import { protect } from "../middleware/authMiddleware.js"; // for protected routes

const router = express.Router();

// 🔐 AUTH ROUTES
router.post("/register", register);
router.post("/login", login);

// 📧 EMAIL VERIFICATION
router.get("/verify/:token", verifyAccount);

// 👤 USER
router.get("/me", getMe);
router.post("/logout", logout);

// 🔑 PASSWORD RESET
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

router.get("/conversations",        protect, getConversations);
router.get("/conversations/:id",    protect, getConversation);
router.delete("/conversations/:id", protect, deleteConversation);
router.delete("/conversations",     protect, clearConversations);
router.delete("/conversations/:id/messages/:index", protect, deleteConversationMessage);

// router.get("/history", protect, getSearchHistory);

// // DELETE /user/history
// router.delete("/history", protect, clearHistory);

export default router;