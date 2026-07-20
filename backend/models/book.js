import mongoose from "mongoose";

const bookSchema = new mongoose.Schema({
  title:         { type: String, required: true, trim: true },
  main_author:   { type: String, trim: true },
  other_authors: [String],
  isbn:          { type: String, trim: true, sparse: true, unique: true },
  edition:       { type: String, trim: true },
  place:         { type: String, trim: true },
  publisher:     { type: String, trim: true },
  year:          { type: Number, min: 1400, max: new Date().getFullYear() + 1 },
  pages:         String,
  subjects:      [String],
  call_number:   { type: String, required: true, trim: true, unique: true, sparse: true },
  notes:         String,
}, { timestamps: true });

// Powers full-text search across the fields your app actually searches on
bookSchema.index({ title: "text", subjects: "text", main_author: "text", notes: "text" });

export default mongoose.model("Book", bookSchema);