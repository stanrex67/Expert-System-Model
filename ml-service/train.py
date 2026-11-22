# ml/train.py — multi-label intent model.
# "FIND_BOOK+LOCATE_BOOK" is now two labels (before: a separate class with ~12 examples).
import json, pickle
import numpy as np
from sklearn.pipeline import FeatureUnion
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.multiclass import OneVsRestClassifier
from sklearn.preprocessing import MultiLabelBinarizer
from sklearn.model_selection import KFold, cross_val_predict
from sklearn.metrics import classification_report

with open("intent_data.json") as f:
    data = json.load(f)

texts  = [d["text"].lower().strip() for d in data]
labels = [d["label"].split("+") for d in data]

mlb = MultiLabelBinarizer()
Y = mlb.fit_transform(labels)

# word n-grams capture phrasing; char n-grams survive student typos ("enginering", "pharmcy")
vectorizer = FeatureUnion([
    ("word", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)),
    ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), sublinear_tf=True)),
])
X = vectorizer.fit_transform(texts)

def make_model():
    return OneVsRestClassifier(LogisticRegression(max_iter=2000, class_weight="balanced", C=4.0))

# Honest estimate of quality (the old script never evaluated anything)
pred = cross_val_predict(make_model(), X, Y, cv=KFold(5, shuffle=True, random_state=42))
print(classification_report(Y, pred, target_names=mlb.classes_, zero_division=0))

model = make_model().fit(X, Y)
pickle.dump(model,      open("intent_model.pkl", "wb"))
pickle.dump(vectorizer, open("vectorizer.pkl",   "wb"))
pickle.dump(mlb,        open("mlb.pkl",          "wb"))
print("✅ Model trained:", list(mlb.classes_))