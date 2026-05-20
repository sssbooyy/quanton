import cors from "cors";
import { getAllowedCorsOrigins, isProduction } from "../config.js";

const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

/** Production SPA on Vercel — always merged with `CORS_ORIGINS` / `FRONTEND_URL`. */
const DEFAULT_BROWSER_ORIGINS = ["https://quanton-nine.vercel.app"];

function normalizeOrigin(o) {
  return o.trim().replace(/\/+$/, "");
}

/**
 * Production: listed origins + env (`CORS_ORIGINS`, `FRONTEND_URL`).
 * Development: same list + any localhost / 127.0.0.1 origin for Vite.
 * `credentials: true` requires a reflected `Access-Control-Allow-Origin` (never `*`).
 */
export function createCorsMiddleware() {
  const allowed = new Set([
    ...DEFAULT_BROWSER_ORIGINS.map(normalizeOrigin),
    ...getAllowedCorsOrigins(),
  ]);

  return cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowed.has(origin)) {
        callback(null, origin);
        return;
      }
      if (!isProduction && LOCALHOST_ORIGIN.test(origin)) {
        callback(null, origin);
        return;
      }
      console.warn("[cors] blocked Origin:", origin);
      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Accept",
      "Authorization",
      "X-Telegram-User-Id",
      "X-Telegram-User-Json",
      "X-Metadata-Sync-Secret",
      "X-Clear-Listings-Secret",
      "X-Debug-Providers-Secret",
    ],
    maxAge: 86400,
  });
}
