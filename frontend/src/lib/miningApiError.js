import { getApiBaseUrl } from "../config.js";

/** Build a user-visible mining error with debug fields for the console. */
export function formatMiningApiError(err, path = "/mine/profile") {
  const baseURL = getApiBaseUrl();
  const url = `${baseURL}${path.startsWith("/") ? path : `/${path}`}`;
  const status = err?.response?.status;
  const data = err?.response?.data;
  const code = err?.code || "";
  const detail = {
    url,
    method: err?.config?.method || "GET",
    status: status ?? "(no response)",
    code,
    message: err?.message || "Request failed",
    responseBody: data ?? null,
  };
  console.error("[mining] request failed", detail);

  if (code === "ERR_NETWORK" || err?.message === "Network Error") {
    return `Network error reaching ${url}. If mining was just deployed, redeploy the backend with updated CORS (X-Telegram-User-Id).`;
  }
  if (typeof data?.error === "string" && data.error) return data.error;
  return err?.message || "Failed to load mining profile.";
}
