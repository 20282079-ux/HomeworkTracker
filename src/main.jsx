import React from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App.jsx";
import "./index.css";

// ── Cloud sync (Convex + Convex Auth with Google) ──
// Cloud sync needs a real Convex deployment URL in VITE_CONVEX_URL. Without
// one (or with the loopback URL that `convex dev` writes locally, which no
// browser outside the sandbox can reach) the app runs purely on
// localStorage (offline-first) and the sync UI stays hidden.
function resolveConvexUrl(raw) {
  if (!raw) return "";
  try {
    const { hostname } = new URL(raw);
    if (hostname === "127.0.0.1" || hostname === "localhost" || hostname === "0.0.0.0") return "";
    return raw;
  } catch {
    return "";
  }
}

const CONVEX_URL = resolveConvexUrl(import.meta.env.VITE_CONVEX_URL);
const convexClient = CONVEX_URL ? new ConvexReactClient(CONVEX_URL) : null;

// ── Service worker registration (PWA offline support) ──
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service Worker registration failed:", err);
    });
  });
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {convexClient ? (
      <ConvexAuthProvider client={convexClient}>
        <App cloudEnabled />
      </ConvexAuthProvider>
    ) : (
      <App cloudEnabled={false} />
    )}
  </React.StrictMode>
);
