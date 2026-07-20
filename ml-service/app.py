from fastapi import FastAPI
from pydantic import BaseModel
import pickle

from semantic_search import semantic_search


app = FastAPI()

# 🔹 Load model once (on startup)
model = pickle.load(open("intent_model.pkl", "rb"))
vectorizer = pickle.load(open("vectorizer.pkl", "rb"))

# 🔹 Define request schema
class QueryRequest(BaseModel):
    query: str

@app.post("/predict")
def predict(data: QueryRequest):
    X = vectorizer.transform([data.query])
    prediction = model.predict(X)[0]
    return {"intent": prediction}

@app.post("/semantic-search")
def search(data: QueryRequest):
    results = semantic_search(data.query)
    return {"results": results}