/**
 * API base URL for Quanton Market backend.
 * - Production: set `VITE_API_URL` in Vercel (or `.env.production`) — no trailing slash.
 * - Development: defaults to `http://localhost:5001` when unset.
 */
function stripTrailingSlashes(url) {
  return url.replace(/\/+$/, "");
}

export function getApiBaseUrl() {
  const raw = import.meta.env.VITE_API_URL;
  if (raw != null && String(raw).trim() !== "") {
    return stripTrailingSlashes(String(raw).trim());
  }
  if (import.meta.env.DEV) {
    return "http://localhost:5001";
  }
  return "";
}

export function isApiBaseUrlConfigured() {
  return getApiBaseUrl() !== "";
}
