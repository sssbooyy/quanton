import cors from "cors";
import { getAllowedCorsOrigins, isProduction } from "../config.js";

const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

/**
 * Production: only listed origins (CORS_ORIGINS / FRONTEND_URL).
 * Development: listed origins + any localhost / 127.0.0.1 with any port.
 * Requests with no Origin (curl, server-to-server) are allowed.
 */
export function createCorsMiddleware() {
  const allowed = new Set(getAllowedCorsOrigins());

  if (isProduction && allowed.size === 0) {
    console.warn(
      "[cors] Production mode but CORS_ORIGINS (or FRONTEND_URL) is empty — browser calls from your SPA will be rejected. Set CORS_ORIGINS on Render."
    );
  }

  return cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowed.has(origin)) {
        callback(null, true);
        return;
      }
      if (!isProduction && LOCALHOST_ORIGIN.test(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept"],
    maxAge: 86400,
  });
}
