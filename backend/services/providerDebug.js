/**
 * Safe diagnostics for external providers (no secrets in responses or logs).
 * @see GET /debug/providers in server.js
 */

import { giftAssetGet } from "./giftAssetHttp.js";
import { resolveGiftAssetAuthMode } from "./giftAssetAuth.js";
import { extractMinFloorTonFromProviderRow } from "./giftAssetPublicClient.js";
import {
  DEBUG_PROVIDERS_SECRET,
  FLOOR_CACHE_TTL_MS,
  GIFT_ASSET_API_KEY,
  GIFT_ASSET_BASE_URL,
  GIFT_ASSET_PROBE_COLLECTION_NAME,
  NODE_ENV,
  REPLICATE_API_TOKEN,
  isProduction,
} from "../config.js";

/** @type {object | null} */
let lastProviderTest = null;

/**
 * Whether the debug route may run (dev always; prod only with shared secret).
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export function assertDebugProvidersAllowed(req, res) {
  if (!isProduction) return true;
  const secret = DEBUG_PROVIDERS_SECRET;
  if (!secret) {
    res.status(404).json({ error: "Not found." });
    return false;
  }
  const h = String(req.headers["x-debug-providers-secret"] ?? "").trim();
  if (h === secret) return true;
  res.status(404).json({ error: "Not found." });
  return false;
}

/**
 * @param {import("axios").AxiosResponse} res
 */
function apiErrorHintFromResponse(res) {
  const d = res.data;
  if (!d || typeof d !== "object") {
    return res.status && res.status !== 200 ? `http_${res.status}` : "";
  }
  if (d.code !== undefined && d.code !== null) return String(d.code);
  return res.status && res.status !== 200 ? `http_${res.status}` : "";
}

/**
 * @param {string} path
 * @param {Record<string, string | number | boolean | undefined>} query
 */
function redactedRequestUrl(path, query) {
  const base = GIFT_ASSET_BASE_URL.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    const val = k === "api_key" ? "(redacted)" : String(v);
    q.set(k, val);
  }
  const qs = q.toString();
  return qs ? `${base}${p}?${qs}` : `${base}${p}`;
}

/**
 * @param {import("axios").AxiosResponse} res
 * @param {"collection_floors" | "providers_fee" | "global_price_list"} kind
 */
function hasUsefulData(res, kind) {
  if (res.status !== 200 || !res.data) return false;
  const d = res.data;
  if (typeof d !== "object") return false;
  if ("code" in d && "message" in d && d.message) return false;
  if (kind === "collection_floors") {
    return extractMinFloorTonFromProviderRow(d.collection_floors) > 0;
  }
  if (kind === "providers_fee") {
    return Array.isArray(d) && d.length > 0;
  }
  if (kind === "global_price_list") {
    return Boolean(d.collection_floors && typeof d.collection_floors === "object");
  }
  return false;
}

/**
 * Multi-endpoint probe (public/provider routes only; no User-Data).
 * @returns {Promise<Record<string, unknown>>}
 */
export async function runGiftAssetProbe() {
  const authModeUsed = resolveGiftAssetAuthMode();
  const collectionName = GIFT_ASSET_PROBE_COLLECTION_NAME;

  if (!GIFT_ASSET_API_KEY) {
    const summary = {
      at: new Date().toISOString(),
      authModeUsed,
      collectionName,
      endpointUsed: "GET /api/v1/gifts/get_unique_gifts_price_list",
      requestUrl: redactedRequestUrl("/api/v1/gifts/get_unique_gifts_price_list", {
        collection_name: collectionName,
      }),
      statusCode: null,
      apiErrorHint: "missing_api_key",
      hasData: false,
      skipped: true,
      reason: "missing_api_key",
      steps: [],
    };
    lastProviderTest = summary;
    return summary;
  }

  /** @type {Record<string, unknown>[]} */
  const steps = [];

  /**
   * @param {string} label
   * @param {string} path
   * @param {Record<string, string | number | boolean | undefined>} query
   * @param {"collection_floors" | "providers_fee" | "global_price_list"} kind
   */
  async function runStep(label, path, query, kind) {
    const endpointUsed = `GET ${path}`;
    const displayQuery = { ...query };
    if (authModeUsed === "query") displayQuery.api_key = "(redacted)";
    const requestUrl = redactedRequestUrl(path, displayQuery);
    let statusCode = 0;
    let apiErrorHint = "";
    let hasData = false;
    let floorFieldHints = [];

    try {
      const res = await giftAssetGet(path, query);
      statusCode = res.status;
      apiErrorHint = apiErrorHintFromResponse(res);
      hasData = hasUsefulData(res, kind);
      if (kind === "collection_floors" && res.data?.collection_floors) {
        const ton = extractMinFloorTonFromProviderRow(res.data.collection_floors);
        floorFieldHints = [`collection_floors.min_ton=${ton}`];
      }
      if (kind === "global_price_list" && res.data?.collection_floors) {
        const cf = res.data.collection_floors;
        floorFieldHints = [`collection_floors.keys(${Object.keys(cf).length})`];
      }
    } catch (e) {
      apiErrorHint = "network_error";
      console.warn("[provider-debug] step network error:", label, e?.message || e);
    }

    const step = {
      label,
      authModeUsed,
      endpointUsed,
      requestUrl,
      statusCode,
      apiErrorHint: apiErrorHint || undefined,
      hasData,
      floorFieldHints,
    };
    steps.push(step);
    console.log("[provider-debug] Gift Asset public step", step);
    return step;
  }

  await runStep(
    "collection_price_list",
    "/api/v1/gifts/get_unique_gifts_price_list",
    { collection_name: collectionName },
    "collection_floors"
  );
  await runStep("global_price_list", "/api/v1/gifts/get_gifts_price_list", {}, "global_price_list");
  await runStep("providers_fee", "/api/v1/gifts/get_providers_fee", {}, "providers_fee");

  const primary = steps[0] || {};
  const summary = {
    at: new Date().toISOString(),
    authModeUsed,
    collectionName,
    endpointUsed: primary.endpointUsed,
    requestUrl: primary.requestUrl,
    statusCode: primary.statusCode,
    apiErrorHint: primary.apiErrorHint,
    hasData: primary.hasData,
    aggregateHasData: steps.some((s) => s.hasData),
    steps,
  };
  lastProviderTest = summary;
  return summary;
}

/**
 * @param {{ runProbe?: boolean }} [opts]
 */
export async function getProvidersDebugResponse(opts = {}) {
  const hasGiftAssetApiKey = Boolean(GIFT_ASSET_API_KEY);
  const giftAssetConfigured = hasGiftAssetApiKey && Boolean(GIFT_ASSET_BASE_URL);
  const replicateConfigured = Boolean(REPLICATE_API_TOKEN);
  const giftAssetAuthMode = resolveGiftAssetAuthMode();

  if (opts.runProbe) {
    await runGiftAssetProbe();
  }

  return {
    giftAssetConfigured,
    giftAssetBaseUrl: GIFT_ASSET_BASE_URL,
    hasGiftAssetApiKey,
    giftAssetAuthMode,
    floorCacheTtlMs: FLOOR_CACHE_TTL_MS,
    replicateConfigured,
    nodeEnv: NODE_ENV,
    lastProviderTest,
    hint: opts.runProbe
      ? "Live probe uses public Gift Asset endpoints only (no User-Data routes)."
      : "Add ?probe=1 to run public Gift Asset checks (updates lastProviderTest).",
  };
}
