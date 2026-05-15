/**
 * Gift Asset API authentication (OpenAPI `ApiKeyAuth`: header `X-API-Key`;
 * some deployments expect Bearer or query `api_key`).
 */

import { GIFT_ASSET_API_KEY, GIFT_ASSET_AUTH_HEADER, GIFT_ASSET_AUTH_MODE } from "../config.js";

/**
 * @returns {"bearer" | "x-api-key" | "api-key" | "query" | "legacy"}
 */
export function resolveGiftAssetAuthMode() {
  const raw = String(GIFT_ASSET_AUTH_MODE ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  if (raw === "bearer") return "bearer";
  if (raw === "x-api-key" || raw === "xapikey") return "x-api-key";
  if (raw === "api-key" || raw === "apikey") return "api-key";
  if (raw === "query") return "query";
  /** Custom header name from `GIFT_ASSET_AUTH_HEADER` (backward compatible). */
  if (raw === "legacy" || raw === "custom" || raw === "header") return "legacy";
  return "x-api-key";
}

/**
 * @returns {{ authModeUsed: ReturnType<typeof resolveGiftAssetAuthMode>; headers: Record<string, string>; extraQuery: Record<string, string> }}
 */
export function buildGiftAssetAuthLayers() {
  const authModeUsed = resolveGiftAssetAuthMode();
  const key = String(GIFT_ASSET_API_KEY || "").trim();
  /** @type {Record<string, string>} */
  const headers = {};
  /** @type {Record<string, string>} */
  const extraQuery = {};
  if (!key) return { authModeUsed, headers, extraQuery };

  switch (authModeUsed) {
    case "bearer":
      headers.Authorization = `Bearer ${key}`;
      break;
    case "x-api-key":
      headers["X-API-Key"] = key;
      break;
    case "api-key":
      headers["api-key"] = key;
      break;
    case "query":
      extraQuery.api_key = key;
      break;
    case "legacy": {
      const hn = String(GIFT_ASSET_AUTH_HEADER || "X-API-Key").trim() || "X-API-Key";
      headers[hn] = key;
      break;
    }
    default:
      headers["X-API-Key"] = key;
  }
  return { authModeUsed, headers, extraQuery };
}
