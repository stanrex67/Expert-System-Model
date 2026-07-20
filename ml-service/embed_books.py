from sentence_transformers import SentenceTransformer
import pickle
import json

model = SentenceTransformer('all-MiniLM-L6-v2')

# Load your dataset (export from Mongo or CSV)
with open("books.json") as f:
    books = json.load(f)

# Combine useful fields
texts = [
    f"{b['title']} {b.get('subjects', '')} {b.get('main_author', '')} {b.get('notes', '')}"
    for b in books
]

embeddings = model.encode(texts)

# Save
pickle.dump(embeddings, open("book_embeddings.pkl", "wb"))
pickle.dump(books, open("books.pkl", "wb"))

print("✅ Embeddings created")