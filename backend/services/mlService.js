import axios from "axios";


//  const ML_URL = "http://127.0.0.1:8000" 
const ML_URL = process.env.ML_SERVICE_URL || "https://expert-system-model-production-ab26ad45.up.railway.app";
const http = axios.create({ baseURL: ML_URL, timeout: 6000 });

// expert-system-model-production-ab26ad45.up.railway.app

export const getMLIntent = async (query) => {
  try {
    const { data } = await http.post("/predict", { query });
    // Low confidence -> return "" so the rule-based boosts in aiController decide.
    return (data.confidence ?? 1) >= 0.35 ? data.intent : "";
  } catch (error) {
    console.error("ML Service Error:", error.message);
    return ""; // was "GENERAL_HELP", which skipped book search whenever the ML service was down
  }
};

export const semanticSearch = async (query, retry = 1) => {
  try {
    const { data } = await http.post("/semantic-search", { query });
    return (data.results || []).filter((r) => (r.score ?? 1) >= 0.35);
  } catch (error) {
    if (retry > 0) return semanticSearch(query, retry - 1); // Railway cold start
    console.error("Semantic Search Error:", error.message);
    return [];
  }
};