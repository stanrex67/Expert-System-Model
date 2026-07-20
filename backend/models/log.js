import mongoose from "mongoose";

const logSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["AI", "AUTH"],
    required: true
  },

  action: String, // e.g. REGISTER, LOGIN, RESET_PASSWORD

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  email: String, // useful when user not yet created

  query: String, // for AI only
  intent: [String],

  response: String,
  success: Boolean,

  ip: String,
  userAgent: String,

  responseTime: Number,

  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model("Log", logSchema);



// import mongoose from "mongoose";

// const logSchema = new mongoose.Schema({
//   user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
//   action: String,
//   metadata: Object
// }, { timestamps: true });

// export default mongoose.model("Log", logSchema);