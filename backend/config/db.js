import mongoose from "mongoose";

const connectDB = async () => {
  try {
    // await mongoose.connect("mongodb://127.0.0.1:27017/library-expert-system");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected");
  } catch (error) {
    console.error("❌ MongoDB error:", error);
    process.exit(1);
  }
};

export default connectDB;

// w2zN36LaOSdfhRB9
// unijosexpertlibraryassistant_db_user