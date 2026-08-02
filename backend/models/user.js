import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  sender: { type: String, enum: ["user", "ai"], required: true },
  text: String,
  intent: [String],
  books: mongoose.Schema.Types.Mixed,
  recommendations: mongoose.Schema.Types.Mixed,
  databases: mongoose.Schema.Types.Mixed,   // — stores database recommendations per message
  openAccessLinks: mongoose.Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  title: String,               // set from the first user query
  messages: [messageSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: {
    type: String,
    enum: ["student", "visitor", "staff", "admin"],
    default: "student"
  },

  isVerified: { type: Boolean, default: false },

  verificationToken: String,
  verificationTokenExpires: Date,

  resetPasswordToken: String,
  resetPasswordExpires: Date,

  // personalization — kept for the recommendation engine in aiController.js
  search_history: [
    {
      query: String,
      timestamp: { type: Date, default: Date.now }
    }
  ],

  // NEW — grouped chat history, ChatGPT-style
  conversations: [conversationSchema],

  interests: [String]
}, { timestamps: true });

export default mongoose.model("User", userSchema);

// import mongoose from "mongoose";

// const userSchema = new mongoose.Schema({
//   name: String,
//   email: { type: String, unique: true },
//   password: String,
//   role: {
//   type: String,
//   enum: ["student", "visitor", "admin"],
//   default: "student"
// },

//   isVerified: { type: Boolean, default: false },

//   verificationToken: String,
//   verificationTokenExpires: Date,

//   resetPasswordToken: String,
//   resetPasswordExpires: Date,

//   //personalization
//   search_history: [
//   {
//     query: String,
//     timestamp: { type: Date, default: Date.now }
//   }
// ],
//   interests: [String]
// }, { timestamps: true });

// export default mongoose.model("User", userSchema);