import React from "react";
import { createRoot } from "react-dom/client";
import { getApiBaseUrl, isApiBaseUrlConfigured } from "./config.js";
import App from "./App.jsx";
import "./styles.css";

if (import.meta.env.PROD && !isApiBaseUrlConfigured()) {
  console.error(
    "[Quanton Market] VITE_API_URL is not set. Set it in Vercel project env vars and redeploy, or the app will call the wrong origin for /gifts."
  );
}

if (import.meta.env.DEV) {
  const base = getApiBaseUrl();
  console.info(`[Quanton Market] API base: ${base || "(not configured)"}`);
}

createRoot(document.getElementById("root")).render(<App />);
