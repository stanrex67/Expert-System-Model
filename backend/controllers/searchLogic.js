import Book from "../models/book.js";

export const searchBooks = async (req, res) => {
  try {
    const { q } = req.query;

    const books = await Book.find({
      $or: [
        { title: { $regex: q, $options: "i" } },
        { main_author: { $regex: q, $options: "i" } },
        { subjects: { $regex: q, $options: "i" } }
      ]
    }).limit(20);

    res.json(books);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};