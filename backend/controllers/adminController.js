import User from "../models/user.js";
import Book from "../models/book.js";
import Log from "../models/log.js";
import mongoose from "mongoose";



// 👤 GET ALL USERS
export const getUsers = async (req, res) => {
  const users = await User.find().select("-password");
  res.json(users);
};

// ❌ DELETE USER
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (req.user?.id === id) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    const target = await User.findById(id);
    if (!target) return res.status(404).json({ message: "User not found" });

    if (target.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        return res.status(400).json({ message: "Cannot delete the last remaining admin account" });
      }
    }

    await User.findByIdAndDelete(id);

    await Log.create({
      type: "ADMIN", action: "DELETE_USER",
      user: req.user?._id, response: `Deleted user ${id}`, success: true,
    });

    res.json({ message: "User deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📊 SYSTEM STATS
export const getStats = async (req, res) => {
  const totalUsers = await User.countDocuments();
  const totalBooks = await Book.countDocuments();
  const totalQueries = await Log.countDocuments();

  const successQueries = await Log.countDocuments({ success: true });

  const successRate = totalQueries
    ? ((successQueries / totalQueries) * 100).toFixed(2)
    : 0;

  res.json({
    totalUsers,
    totalBooks,
    totalQueries,
    successRate
  });
};

export const getLogs = async (req, res) => {
  try {
    const {
      type,
      action,
      success,
      userId,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;

 const sanitize = (v) => (typeof v === "string" ? v : undefined);

let filter = {};
if (sanitize(type))   filter.type = type;
if (sanitize(action)) filter.action = action;
if (success !== undefined) filter.success = success === "true";
if (sanitize(userId) && mongoose.isValidObjectId(userId)) filter.user = userId;


    // 🔹 Pagination
    const skip = (page - 1) * limit;

    const logs = await Log.find(filter)
      .populate("user", "email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Log.countDocuments(filter);

    res.json({
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      results: logs
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📊 PERFORMANCE METRICS
export const getPerformance = async (req, res) => {
  try {
    const result = await Log.aggregate([
      { $group: { _id: null, avgTime: { $avg: "$responseTime" }, count: { $sum: 1 } } }
    ]);

    res.json({
      averageResponseTime: (result[0]?.avgTime || 0).toFixed(2),
      totalQueries: result[0]?.count || 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📂 BULK UPLOAD BOOKS
export const uploadBooks = async (req, res) => {
  try {
    const books = req.body;

    if (!Array.isArray(books) || books.length === 0) {
      return res.status(400).json({ message: "Request body must be a non-empty array of books" });
    }
    if (books.length > 2000) {
      return res.status(400).json({ message: "Upload too large — split into smaller batches (max 2000)" });
    }

    const invalid = books.filter(b => !b.title || !b.call_number);
    if (invalid.length > 0) {
      return res.status(400).json({
        message: `${invalid.length} entries missing required fields (title, call_number)`,
      });
    }

    const result = await Book.insertMany(books, { ordered: false });
    res.json({ message: "Books uploaded successfully", count: result.length });

  } catch (error) {
    res.status(500).json({ message: "Bulk upload failed", error: error.message });
  }
};

// 📊 OVERVIEW METRICS
export const getOverview = async (req, res) => {
  try {
    const totalQueries = await Log.countDocuments({ type: "AI" });

    const successful = await Log.countDocuments({
      type: "AI",
      success: true
    });

    const failed = await Log.countDocuments({
      type: "AI",
      success: false
    });

    const avgResponseTime = await Log.aggregate([
      { $match: { type: "AI" } },
      {
        $group: {
          _id: null,
          avgTime: { $avg: "$responseTime" }
        }
      }
    ]);

    res.json({
      totalQueries,
      successful,
      failed,
      successRate: totalQueries
        ? ((successful / totalQueries) * 100).toFixed(2)
        : 0,
      avgResponseTime: avgResponseTime[0]?.avgTime || 0
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const getTopQueries = async (req, res) => {
  try {
    const topQueries = await Log.aggregate([
      { $match: { type: "AI" } },
      {
        $group: {
          _id: "$query",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json(topQueries);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getIntentStats = async (req, res) => {
  try {
    const intents = await Log.aggregate([
      { $match: { type: "AI" } },
      { $unwind: "$intent" },
      {
        $group: {
          _id: "$intent",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json(intents);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getFailures = async (req, res) => {
  try {
    const failures = await Log.find({
      type: "AI",
      success: false
    })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json(failures);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getDailyUsage = async (req, res) => {
  try {
    const usage = await Log.aggregate([
      { $match: { type: "AI" } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json(usage);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAuthStats = async (req, res) => {
  try {
    const totalLogins = await Log.countDocuments({
      type: "AUTH",
      action: "LOGIN"
    });

    const failedLogins = await Log.countDocuments({
      type: "AUTH",
      action: "LOGIN",
      success: false
    });

    const registrations = await Log.countDocuments({
      type: "AUTH",
      action: "REGISTER"
    });

    res.json({
      totalLogins,
      failedLogins,
      registrations
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

