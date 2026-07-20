// ─── In App.jsx — pass resetChat down ────────────────────────────────────────
// Add a ref that Dashboard exposes, then pass it to Navbar via AppRoutes.
// The simplest approach: lift a resetChat callback into AppRoutes.

import { useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { setNavigate } from "./api/authApi";
import Login          from "./pages/login";
import Register       from "./pages/register";
import Verify         from "./pages/verify";
import ForgotPassword from "./pages/forgotPassword";
import ResetPassword  from "./pages/resetPassword";
import Dashboard      from "./pages/dashboard";
import Navbar         from "./components/Navbar";
import AdminDashboard from "./pages/AdminDashboard";



function AppRoutes() {
  const navigate = useNavigate();

  // Holds a reset function registered by Dashboard on mount
  const resetChatRef = useRef(null);

  useEffect(() => {
    setNavigate(navigate);
  }, [navigate]);

  return (
    <>
      {/* Pass onNewChat to Navbar */}
      {/* <Navbar onNewChat={() => resetChatRef.current?.()} /> */}
      <Routes>
        <Route path="/login"                 element={<Login />} />
        <Route path="/register"              element={<Register />} />
        <Route path="/verify/:token"         element={<Verify />} />
        <Route path="/forgot-password"       element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        {/* Pass the ref so Dashboard can register its reset fn */}
        <Route path="/" element={<Dashboard resetRef={resetChatRef} />} />

        
        <Route path="/admin" element={<AdminDashboard />} />

      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;


// ─── In Dashboard.jsx — register the reset function ──────────────────────────
// Add this prop and useEffect near the top of your Dashboard component:

// export default function Dashboard({ resetRef }) {
//   ...existing state...
//
//   // Register reset fn so Navbar's "New Chat" can clear chat without reload
//   useEffect(() => {
//     if (resetRef) {
//       resetRef.current = () => {
//         setChat([]);
//         setQuery("");
//       };
//     }
//   }, [resetRef]);
//
//   ...rest of Dashboard...
// }