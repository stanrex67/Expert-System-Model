import axios from "axios";

export const getMLIntent = async (query) => {
  try {
    const res = await axios.post("https://uj-expert-system-production-7ee9.up.railway.app/predict", {
      query
    });

    return res.data.intent;
  } catch (error) {
    console.error("ML Service Error:", error.message);

    // fallback (important)
    return "GENERAL_HELP";
  }
};

// mlService.js
export const semanticSearch = async (query) => {
  try {
    const res = await axios.post("http://localhost:5001/semantic-search", { query });
    // only keep genuinely relevant hits
    return (res.data.results || []).filter(r => (r.score ?? 1) >= 0.35);
  } catch (error) {
    console.error("Semantic Search Error:", error.message);
    return [];
  }
};
