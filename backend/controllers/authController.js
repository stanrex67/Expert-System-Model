// controllers/authController.js
import User          from "../models/user.js";
import bcrypt        from "bcryptjs";
import jwt           from "jsonwebtoken";
import { generateToken } from "../utils/generateToken.js";
import sendEmail     from "../utils/sendEmail.js";
import { logEvent }  from "../utils/logEvent.js";
import dotenv        from "dotenv";
dotenv.config();

// Frontend URL — where React is running
// In production set CLIENT_URL in your .env to your deployed frontend URL
const CLIENT_URL = process.env.CLIENT_URL || "https://uj-expert-system-two.vercel.app";

const buildVerificationEmail = (name, link) => `
  <div style="font-family: Georgia, serif; max-width: 520px; margin: auto; padding: 32px; border: 1px solid #D6CFC0; border-radius: 8px;">
    <h2 style="color: #0B1F3A;">Welcome to UNIJOS Library, ${name}!</h2>
    <p style="color: #6b7280;">Please verify your email address to activate your account.</p>
    <a href="${link}" style="display:inline-block; margin-top:16px; padding:12px 28px; background:#C9A84C; color:#0B1F3A; font-weight:bold; border-radius:6px; text-decoration:none;">
      Verify Account
    </a>
    <p style="margin-top:24px; font-size:0.8rem; color:#9ca3af;">
      This link expires in 1 hour. If you did not register, ignore this email.
    </p>
  </div>
`;

// ── Register ──────────────────────────────────────────────────────────────────
export const register = async (req, res) => {
  const startTime = Date.now();

  try {
    const { name, email, password, role } = req.body;

    const existing = await User.findOne({ email });

    if (existing) {
      if (existing.isVerified) {
        return res.status(400).json({ message: "An account with this email already exists. Please sign in instead." });
      }

      // Account exists but was never verified — likely a previous failed
      // email send. Regenerate the token and resend, rather than permanently
      // blocking this email address.
      const verificationToken = generateToken();
      existing.verificationToken = verificationToken;
      existing.verificationTokenExpires = Date.now() + 3600000;
      // Allow them to update their name/password if they're retrying registration
      if (password) existing.password = await bcrypt.hash(password, 10);
      if (name) existing.name = name;
      await existing.save();

      const link = `${CLIENT_URL}/verify/${verificationToken}`;

      try {
        console.log("Verification URL:", link);
        console.log(buildVerificationEmail(name, link));
        await sendEmail({
          to: email,
          subject: "Verify your UNIJOS Library account",
          html: buildVerificationEmail(existing.name, link),
        });
      } catch (emailError) {
        console.error("Resend verification email failed:", emailError.message);
        await logEvent({ type: "AUTH", action: "REGISTER", user: existing._id, email, success: false,
          response: `Email resend failed: ${emailError.message}`, req });
        return res.status(502).json({
          message: "Your account exists but we couldn't send the verification email right now. Please try again shortly.",
        });
      }

      await logEvent({ type: "AUTH", action: "REGISTER", user: existing._id, email, success: true,
        response: "Resent verification email", req, responseTime: Date.now() - startTime });

      return res.json({ message: "A new verification link has been sent to your email." });
    }

    // ── Brand-new registration ──────────────────────────────────────────────
    const hashedPassword    = await bcrypt.hash(password, 10);
    const verificationToken = generateToken();

    const user = await User.create({
      name, email, password: hashedPassword, role: role || "student",
      verificationToken,
      verificationTokenExpires: Date.now() + 3600000,
    });

    const link = `${CLIENT_URL}/verify/${verificationToken}`;

    // ── Email send is now isolated — if it fails, the user is told clearly
    //    and can retry (which now hits the "resend" branch above, not a dead end) ──
    try {
      await sendEmail({
        to: email,
        subject: "Verify your UNIJOS Library account",
        html: buildVerificationEmail(name, link),
      });
    } catch (emailError) {
      console.error("Verification email failed to send:", emailError.message);
      await logEvent({ type: "AUTH", action: "REGISTER", user: user._id, email, success: false,
        response: `Account created but email failed: ${emailError.message}`, req });

      return res.status(202).json({
        message: "Account created, but we couldn't send the verification email right now. Please try registering again with the same email to resend it.",
      });
    }

    await logEvent({ type: "AUTH", action: "REGISTER", user: user._id, email, success: true,
      req, responseTime: Date.now() - startTime });

    res.json({ message: "Registration successful. Check your email to verify your account." });

  } catch (error) {
    // Handle the race-condition case: two near-simultaneous requests for the
    // same email both pass the findOne check before either commits.
    if (error.code === 11000) {
      return res.status(400).json({ message: "An account with this email already exists. Please sign in instead." });
    }

    await logEvent({ type: "AUTH", action: "REGISTER", email: req.body?.email, success: false,
      response: error.message, req });
    res.status(500).json({ message: "Registration failed. Please try again." });
  }
};

// ── Verify account ────────────────────────────────────────────────────────────
export const verifyAccount = async (req, res) => {
  const startTime = Date.now(); // ← was missing

  try {
    const { token } = req.params;

    const user = await User.findOne({
      verificationToken:        token,
      verificationTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired verification link." });
    }

    user.isVerified               = true;
    user.verificationToken        = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    await logEvent({
      type: "AUTH", action: "VERIFY",
      user: user._id, email: user.email, // ← was using undefined `email`
      success: true, req,
      responseTime: Date.now() - startTime,
    });

    res.json({ message: "Account verified successfully. You can now sign in." });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────
export const login = async (req, res) => {
  const startTime = Date.now();

  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      await logEvent({ type: "AUTH", action: "LOGIN", email, success: false, response: "User not found", req });
      return res.status(400).json({ message: "No account found with this email." });
    }

    if (!user.isVerified) {
      await logEvent({ type: "AUTH", action: "LOGIN", user: user._id, email, success: false, response: "Not verified", req });
      return res.status(400).json({ message: "Please verify your email before signing in." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await logEvent({ type: "AUTH", action: "LOGIN", user: user._id, email, success: false, response: "Invalid password", req });
      return res.status(400).json({ message: "Incorrect password." });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    await logEvent({
      type: "AUTH", action: "LOGIN",
      user: user._id, email, success: true,
      req, responseTime: Date.now() - startTime,
    });

    res.json({
      token,
      data: {
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      },
      // also at top level for backward compat with frontend localStorage.setItem
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Get current user ──────────────────────────────────────────────────────────
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Logout ────────────────────────────────────────────────────────────────────
export const logout = async (req, res) => {
  res.json({ message: "Logged out successfully" });
};

// ── Forgot password ───────────────────────────────────────────────────────────
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    // Don't reveal whether the email exists — security best practice
    if (!user) {
      return res.json({ message: "If an account exists for this email, a reset link has been sent." });
    }

    const resetToken = generateToken();
    user.resetPasswordToken   = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const link = `${CLIENT_URL}/reset-password/${resetToken}`;

    await sendEmail({
      to:      email,
      subject: "Reset your UNIJOS Library password",
      html: `
        <div style="font-family: Georgia, serif; max-width: 520px; margin: auto; padding: 32px; border: 1px solid #D6CFC0; border-radius: 8px;">
          <h2 style="color: #0B1F3A;">Password Reset Request</h2>
          <p style="color: #6b7280;">Click the button below to set a new password. This link expires in 1 hour.</p>
          <a href="${link}" style="display:inline-block; margin-top:16px; padding:12px 28px; background:#C9A84C; color:#0B1F3A; font-weight:bold; border-radius:6px; text-decoration:none;">
            Reset Password
          </a>
          <p style="margin-top:24px; font-size:0.8rem; color:#9ca3af;">
            If you did not request a password reset, ignore this email.
          </p>
        </div>
      `,
    });

    await logEvent({ type: "AUTH", action: "FORGOT_PASSWORD", email, success: true, req });

    res.json({ message: "If an account exists for this email, a reset link has been sent." });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Reset password ────────────────────────────────────────────────────────────
export const resetPassword = async (req, res) => {
  try {
    const { token }    = req.params;
    const { password } = req.body;

    const user = await User.findOne({
      resetPasswordToken:   token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset link." });
    }

    user.password             = await bcrypt.hash(password, 10);
    user.resetPasswordToken   = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    await logEvent({ type: "AUTH", action: "RESET_PASSWORD", user: user._id, success: true, req });

    res.json({ message: "Password reset successful. You can now sign in." });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// ── List conversations (sidebar) ──────────────────────────────────────────────
export const getConversations = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const list = [...(user.conversations || [])]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 30)
      .map(c => ({
        id: c._id,
        title: c.title,
        updatedAt: c.updatedAt,
      }));

    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Load one full conversation ────────────────────────────────────────────────
export const getConversation = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const convo = user.conversations.id(req.params.id);
    if (!convo) return res.status(404).json({ message: "Conversation not found" });

    res.json({ success: true, data: convo });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Delete one conversation ───────────────────────────────────────────────────
export const deleteConversation = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.conversations = user.conversations.filter(
      c => c._id.toString() !== req.params.id
    );
    await user.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Clear all conversations ───────────────────────────────────────────────────
export const clearConversations = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.conversations = [];
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};



// ── Delete one message (and its paired reply) from a conversation ────────────
export const deleteConversationMessage = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const convo = user.conversations.id(req.params.id);
    if (!convo) return res.status(404).json({ message: "Conversation not found" });

    const index = parseInt(req.params.index, 10);
    if (isNaN(index) || index < 0 || index >= convo.messages.length) {
      return res.status(400).json({ message: "Invalid message index" });
    }

    // Messages are stored in pairs: [user, ai, user, ai, ...].
    // Deleting either half of a turn removes both halves together.
    const isUserMsg = convo.messages[index].sender === "user";
    const pairIndex = isUserMsg ? index + 1 : index - 1;

    const indicesToRemove = [index];
    if (pairIndex >= 0 && pairIndex < convo.messages.length) {
      indicesToRemove.push(pairIndex);
    }
    indicesToRemove.sort((a, b) => b - a); // remove highest index first so splicing doesn't shift the other

    indicesToRemove.forEach(i => convo.messages.splice(i, 1));
    convo.updatedAt = new Date();
    await user.save();

    res.json({ success: true, data: convo });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Search history ────────────────────────────────────────────────────────────
// export const getSearchHistory = async (req, res) => {
//   try {
//     const user = await User.findById(req.user.id);
//     if (!user) return res.status(404).json({ message: "User not found" });

//     const history = [...(user.search_history || [])]
//       .sort((a, b) => b.timestamp - a.timestamp)
//       .slice(0, 20);

//     res.json({ success: true, data: history });

//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// // ── Delete single history entry ───────────────────────────────────────────────
// export const deleteHistoryItem = async (req, res) => {
//   try {
//     const user  = await User.findById(req.user.id);
//     const query = decodeURIComponent(req.params.query);

//     user.search_history = (user.search_history || []).filter(
//       item => item.query !== query
//     );
//     await user.save();

//     res.json({ success: true });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// // ── Clear all history ─────────────────────────────────────────────────────────
// export const clearHistory = async (req, res) => {
//   try {
//     const user = await User.findById(req.user.id);
//     user.search_history = [];
//     await user.save();
//     res.json({ success: true });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };