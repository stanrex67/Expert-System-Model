import User from "../models/user.js";
import Book from "../models/book.js";
import Log from "../models/log.js";

// 👤 GET ALL USERS
export const getUsers = async (req, res) => {
  const users = await User.find().select("-password");
  res.json(users);
};

// ❌ DELETE USER
export const deleteUser = async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ message: "User deleted" });
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

    let filter = {};

    // 🔹 Filter by type (AI / AUTH)
    if (type) {
      filter.type = type;
    }

    // 🔹 Filter by action (LOGIN, REGISTER, etc.)
    if (action) {
      filter.action = action;
    }

    // 🔹 Filter by success
    if (success !== undefined) {
      filter.success = success === "true";
    }

    // 🔹 Filter by user
    if (userId) {
      filter.user = userId;
    }

    // 🔹 Filter by date range
    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }

      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

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
  const logs = await Log.find();

  const avgResponseTime =
    logs.reduce((acc, l) => acc + (l.responseTime || 0), 0) /
    (logs.length || 1);

  res.json({
    averageResponseTime: avgResponseTime.toFixed(2),
    totalQueries: logs.length
  });
};

// 📂 BULK UPLOAD BOOKS
export const uploadBooks = async (req, res) => {
  const books = req.body; // array

  await Book.insertMany(books);

  res.json({ message: "Books uploaded successfully" });
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