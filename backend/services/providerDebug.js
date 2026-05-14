/**
 * Safe diagnostics for external providers (no secrets in responses or logs).
 * @see GET /debug/providers in server.js
 */

import axios from "axios";
import {
  DEBUG_PROVIDERS_SECRET,
  FLOOR_CACHE_TTL_MS,
  GIFT_ASSET_API_KEY,
  GIFT_ASSET_AUTH_HEADER,
  GIFT_ASSET_BASE_URL,
  NODE_ENV,
  REPLICATE_API_TOKEN,
  isProduction,
} from "../config.js";

/** Default Gift Asset name used for connectivity probes (stable public-style id). */
const DEFAULT_PROBE_GIFT_NAME = "EasterEgg-1";

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
 * @param {unknown} payload
 */
function collectFloorFieldHints(payload) {
  if (!payload || typeof payload !== "object") return [];
  const hints = [];
  const mf = /** @type {Record<string, unknown>} */ (payload).market_floor;
  if (mf && typeof mf === "object") {
    for (const k of Object.keys(mf)) hints.push(`market_floor.${k}`);
  }
  const prov = /** @type {Record<string, unknown>} */ (payload).providers;
  if (prov && typeof prov === "object") {
    for (const [pk, row] of Object.entries(prov)) {
      if (!row || typeof row !== "object") continue;
      for (const k of Object.keys(row)) {
        if (/floor|ton|price|sales/i.test(k)) hints.push(`providers.${pk}.${k}`);
      }
    }
  }
  return [...new Set(hints)].slice(0, 48);
}

/**
 * @param {unknown} payload
 */
function collectMediaFieldHints(payload) {
  if (!payload || typeof payload !== "object") return [];
  const hints = [];
  const p = /** @type {Record<string, unknown>} */ (payload);
  if (p.media_preview) hints.push("media_preview");
  const m = p.media;
  if (m && typeof m === "object") {
    for (const k of Object.keys(m)) {
      if (k === "pics") {
        const pics = /** @type {unknown} */ (m.pics);
        const shape = Array.isArray(pics) ? `array(len=${pics.length})` : typeof pics;
        hints.push(`media.pics(${shape})`);
      } else {
        hints.push(`media.${k}`);
      }
    }
  }
  return [...new Set(hints)].slice(0, 32);
}

/**
 * Temporary probe: one GET to Gift Asset `get_gift_by_name`, logs safe facts, stores summary.
 * Never logs API keys or response bodies.
 * @param {string} [giftName]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function runGiftAssetProbe(giftName) {
  const name = String(giftName || process.env.GIFT_ASSET_PROBE_NAME || DEFAULT_PROBE_GIFT_NAME).trim();
  const base = GIFT_ASSET_BASE_URL.replace(/\/+$/, "");
  const path = "/api/v1/gifts/get_gift_by_name";
  const requestUrl = `${base}${path}?name=${encodeURIComponent(name)}`;

  if (!GIFT_ASSET_API_KEY) {
    const summary = {
      at: new Date().toISOString(),
      giftName: name,
      requestUrl,
      skipped: true,
      reason: "missing_api_key",
      statusCode: null,
      hasData: false,
      floorFieldHints: [],
      mediaFieldHints: [],
    };
    lastProviderTest = summary;
    console.log("[provider-debug] Gift Asset probe skipped (no API key)", {
      requestUrl,
      statusCode: null,
      hasData: false,
    });
    return summary;
  }

  let statusCode = 0;
  let hasJson = false;
  let hasGiftPayload = false;
  let floorFieldHints = [];
  let mediaFieldHints = [];
  let apiErrorHint = "";

  try {
    const res = await axios.get(`${base}${path}`, {
      params: { name },
      headers: { [GIFT_ASSET_AUTH_HEADER]: GIFT_ASSET_API_KEY },
      timeout: 18_000,
      validateStatus: () => true,
    });
    statusCode = res.status;
    hasJson = Boolean(res.data && typeof res.data === "object");
    const data = hasJson ? res.data : null;
    if (data && typeof data.code !== "undefined" && data.message) {
      apiErrorHint = String(data.code || "api_error");
      hasGiftPayload = false;
    } else if (data && (data.telegram_gift_name || data.id || data.media)) {
      hasGiftPayload = true;
      floorFieldHints = collectFloorFieldHints(data);
      mediaFieldHints = collectMediaFieldHints(data);
    } else if (res.status !== 200) {
      apiErrorHint = `http_${res.status}`;
    }
  } catch (e) {
    statusCode = 0;
    hasJson = false;
    apiErrorHint = "network_error";
    console.warn("[provider-debug] Gift Asset probe network error:", e?.message || e);
  }

  const hasData = hasGiftPayload;
  const summary = {
    at: new Date().toISOString(),
    giftName: name,
    requestUrl,
    skipped: false,
    statusCode,
    hasJsonBody: hasJson,
    hasGiftPayload,
    hasData,
    apiErrorHint: apiErrorHint || undefined,
    floorFieldHints,
    mediaFieldHints,
  };
  lastProviderTest = summary;

  console.log("[provider-debug] Gift Asset probe", {
    requestUrl,
    statusCode,
    hasData,
    floorFieldHints,
    mediaFieldHints,
  });

  return summary;
}

/**
 * @param {{ runProbe?: boolean }} [opts]
 */
export async function getProvidersDebugResponse(opts = {}) {
  const hasGiftAssetApiKey = Boolean(GIFT_ASSET_API_KEY);
  const giftAssetConfigured = hasGiftAssetApiKey && Boolean(GIFT_ASSET_BASE_URL);
  const replicateConfigured = Boolean(REPLICATE_API_TOKEN);

  if (opts.runProbe) {
    await runGiftAssetProbe();
  }

  return {
    giftAssetConfigured,
    giftAssetBaseUrl: GIFT_ASSET_BASE_URL,
    hasGiftAssetApiKey,
    floorCacheTtlMs: FLOOR_CACHE_TTL_MS,
    replicateConfigured,
    nodeEnv: NODE_ENV,
    lastProviderTest,
    hint: opts.runProbe
      ? "Live probe executed; see server logs for the same summary."
      : "Add ?probe=1 to run a live Gift Asset request once (updates lastProviderTest; logs to console).",
  };
}
