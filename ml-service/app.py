from fastapi import FastAPI
from pydantic import BaseModel
import pickle

from semantic_search import semantic_search

app = FastAPI()

model      = pickle.load(open("intent_model.pkl", "rb"))
vectorizer = pickle.load(open("vectorizer.pkl", "rb"))
mlb        = pickle.load(open("mlb.pkl", "rb"))

INTENT_THRESHOLD = 0.40

class QueryRequest(BaseModel):
    query: str
    top_k: int = 50

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/predict")
def predict(data: QueryRequest):
    X = vectorizer.transform([data.query.lower().strip()])
    probs = model.predict_proba(X)[0]
    ranked = sorted(zip(mlb.classes_, probs), key=lambda x: -x[1])
    chosen = [c for c, p in ranked if p >= INTENT_THRESHOLD] or [ranked[0][0]]
    return {
        "intent": "+".join(chosen),            # same format the Node code already parses
        "confidence": float(ranked[0][1]),     # Node falls back to rule-based intent when low
        "scores": {c: round(float(p), 3) for c, p in ranked},
    }

@app.post("/semantic-search")
def search(data: QueryRequest):
    return {"results": semantic_search(data.query, data.top_k)}