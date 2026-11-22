# ml/embed_books.py — re-run whenever the catalogue changes.
import json, pickle, re
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")

with open("books.json") as f:
    books = json.load(f)

def norm(s):
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())

# drop untitled records and exact duplicates (the catalogue has several)
seen, clean = set(), []
for b in books:
    if not b.get("title"):
        continue
    key = (norm(b["title"])[:70], norm(b.get("call_number")))
    if key in seen:
        continue
    seen.add(key)
    clean.append(b)

def book_text(b):
    # FIX 1: subjects is a list — the old f-string embedded "['Diagnosis treatment']".
    # FIX 2: `notes` is intentionally excluded: it only holds accession numbers and
    #        cataloguer initials ("B-0175071, ahj, 16/3/16"), which is noise in the vector.
    subjects = ", ".join(dict.fromkeys(b.get("subjects") or []))
    return f"{b['title']}. Subjects: {subjects}. Author: {b.get('main_author') or ''}"

texts = [book_text(b) for b in clean]
embeddings = model.encode(texts, batch_size=64, normalize_embeddings=True,
                          show_progress_bar=True).astype("float32")

pickle.dump(embeddings, open("book_embeddings.pkl", "wb"))
pickle.dump(clean,      open("books.pkl", "wb"))
print(f"✅ Embedded {len(clean)} books (from {len(books)} records)")