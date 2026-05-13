/**
 * API base URL for Quanton Market backend.
 *
 * Resolution order:
 * 1. `import.meta.env.VITE_API_URL` when set (e.g. Vercel project env or `vercel.json` build env).
 * 2. Production builds (`import.meta.env.PROD`): `DEFAULT_PRODUCTION_API_BASE_URL` (never localhost).
 * 3. Local Vite dev: `http://localhost:5001` when unset.
 */

export const DEFAULT_PRODUCTION_API_BASE_URL = "https://quanton.onrender.com";

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
  return DEFAULT_PRODUCTION_API_BASE_URL;
}

/** True when an explicit env URL was provided at build time (not dev default, not prod fallback). */
export function hasExplicitApiUrlFromEnv() {
  const raw = import.meta.env.VITE_API_URL;
  return raw != null && String(raw).trim() !== "";
}
