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
app.use(cors({
  origin: "http://localhost:5173", // your frontend
  credentials: true
}));

app.use(express.json());

app.use("/api/books", bookRoute);
app.use("/api/ai", aiRoute);
app.use("/api/auth", authRoute);
app.use("/api/admin", adminRoute);

app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});