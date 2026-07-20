import numpy as np
import pickle
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('all-MiniLM-L6-v2')

embeddings = pickle.load(open("book_embeddings.pkl", "rb"))
books = pickle.load(open("books.pkl", "rb"))

def semantic_search(query, top_k=50):
    q_emb = model.encode([query])[0]

    scores = np.dot(embeddings, q_emb)

    best_idx = np.argsort(scores)[-top_k:][::-1]

    results = []
    for i in best_idx:
        book = dict(books[i]) if not isinstance(books[i], dict) else books[i].copy()
        book["score"] = float(scores[i])   # ← now the Node-side filter actually means something
        results.append(book)

    return results