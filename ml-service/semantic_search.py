import numpy as np
import pickle
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")

embeddings = pickle.load(open("book_embeddings.pkl", "rb"))
books      = pickle.load(open("books.pkl", "rb"))

def semantic_search(query, top_k=50, min_score=0.30):
    q = model.encode([query], normalize_embeddings=True)[0]
    scores = embeddings @ q                      # cosine similarity (both sides normalised)
    top = np.argpartition(-scores, min(top_k, len(scores) - 1))[:top_k]
    top = top[np.argsort(-scores[top])]

    results = []
    for i in top:
        if scores[i] < min_score:
            break
        b = dict(books[i])
        b["score"] = float(scores[i])
        results.append(b)
    return results