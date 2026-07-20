import { searchBooks } from "../controllers/searchLogic.js";
import express from "express";


const router = express.Router();

router.get("/search", searchBooks);

export default router;