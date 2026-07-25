import express from "express";
import cors from "cors"; //  ADD THIS
import connectDB from "./config/db.js";
import bookRoute from "./routes/bookRoute.js";
import aiRoute from "./routes/aiRoute.js";
import authRoute from "./routes/authRoute.js";
import adminRoute from "./routes/adminRoute.js";
import dotenv from "dotenv";
dotenv.config();


const app = express();

//  Connect DB
connectDB();

//  ENABLE CORS
const allowedOrigins = [
  "http://localhost:5173",
  "https://uj-expert-system-two.vercel.app/",
  process.env.CLIENT_URL, // set this on Railway once your frontend is deployed
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (e.g. mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

app.use(express.json());

app.use("/api/books", bookRoute);
app.use("/api/ai", aiRoute);
app.use("/api/auth", authRoute);
app.use("/api/admin", adminRoute);

app.listen(8080, () => {
  console.log("🚀 Server running on port 8080");
});