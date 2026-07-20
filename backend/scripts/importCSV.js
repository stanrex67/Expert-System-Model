import fs from "fs";
import csv from "csv-parser";
import mongoose from "mongoose";
import Book from "../models/book.js";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";


await connectDB();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



const results = [];

fs.createReadStream(path.join(__dirname, "../data/ml_dataset.csv"))
  .pipe(csv())
  .on("data", (data) => {
    results.push({
      title: data.title,
      main_author: data.main_author,
      other_authors: data.other_authors ? data.other_authors.split("|") : [],
      isbn: data.isbn,
      edition: data.edition,
      place: data.place,
      publisher: data.publisher,
      year: parseInt(data.year) || null,
      pages: data.pages,
      subjects: data.subjects ? data.subjects.split("|") : [],
      call_number: data.call_number,
      notes: data.notes
    });
  })
  .on("end", async () => {
    try {
      await Book.insertMany(results, { ordered: false });
      console.log("✅ Data imported!");
    } catch (err) {
      console.error("❌ Import error:", err);
    } finally {
      mongoose.connection.close(); // 🔥 better than process.exit()
    }
  });