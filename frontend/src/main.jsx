import React from "react";
import { createRoot } from "react-dom/client";
import {
  DEFAULT_PRODUCTION_API_BASE_URL,
  getApiBaseUrl,
  hasExplicitApiUrlFromEnv,
} from "./config.js";
import App from "./App.jsx";
import "./styles.css";

if (import.meta.env.PROD && !hasExplicitApiUrlFromEnv()) {
  console.info(
    `[Quanton Market] VITE_API_URL not set at build time; using production API ${DEFAULT_PRODUCTION_API_BASE_URL}. Set VITE_API_URL on Vercel to override.`
  );
}

if (import.meta.env.DEV) {
  console.info(`[Quanton Market] API base: ${getApiBaseUrl()}`);
}

createRoot(document.getElementById("root")).render(<App />);
