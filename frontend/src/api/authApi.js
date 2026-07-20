import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000/api",
});

// ── Attach token to every request ────────────────────────────────────────────
API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

// ── Global session-expiry handler ─────────────────────────────────────────────
//
// Strategy: clear storage, then navigate to "/" which renders the Dashboard's
// unauthenticated landing (!token branch) via React Router — no hard reload,
// no flicker, no lost router state.
//
// We attach the navigate function from outside (set once on app mount) so the
// interceptor can use React Router's navigate instead of window.location.
//
let _navigateFn = null;

/** Call this once in your App component: setNavigate(navigate) */
export const setNavigate = (fn) => { _navigateFn = fn; };

API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Clear session
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      if (_navigateFn) {
        // React Router navigation — stays inside the SPA, Dashboard re-renders
        // to its !token branch (the unauthenticated landing page)
        _navigateFn("/", { replace: true });
      } else {
        // Fallback if navigate wasn't registered yet (e.g. very early error)
        window.location.href = "/";
      }
    }

    return Promise.reject(err);
  }
);

export default API;