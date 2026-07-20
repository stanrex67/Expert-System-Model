import mongoose from "mongoose";

const bookSchema = new mongoose.Schema({
  title: String,
  main_author: String,
  other_authors: [String],
  isbn: String,
  edition: String,
  place: String,
  publisher: String,
  year: Number,
  pages: String,
  subjects: [String],
  call_number: String,
  notes: String
}, { timestamps: true });

export default mongoose.model("Book", bookSchema);