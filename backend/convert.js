import fs from "fs";
import csv from "csv-parser";

const results = [];

fs.createReadStream("./data/ml_dataset.csv")
  .pipe(csv())
  .on("data", (data) => {
    results.push({
      title: data.title,
      main_author: data.main_author,
      other_authors: data.other_authors
        ? data.other_authors.split("|").map(a => a.trim())
        : [],
      isbn: data.isbn,
      edition: data.edition,
      place: data.place,
      publisher: data.publisher,
      year: parseInt(data.year) || null,
      pages: data.pages,
      subjects: data.subjects
        ? data.subjects.split("|").map(s => s.trim())
        : [],
      call_number: data.call_number,
      notes: data.notes
    });
  })
  .on("end", () => {
    fs.writeFileSync("books.json", JSON.stringify(results, null, 2));
    console.log("✅ books.json created successfully!");
  });