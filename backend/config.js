import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const NODE_ENV = process.env.NODE_ENV || "development";
export const isProduction = NODE_ENV === "production";

/** Render and other hosts set PORT; local default 5001 */
export const PORT = (() => {
  const n = Number.parseInt(process.env.PORT, 10);
  return Number.isFinite(n) && n > 0 ? n : 5001;
})();

/**
 * Writable directory for gifts.json. On Render, attach a Disk and set e.g.
 * DATA_DIR=/var/data/quanton (must exist or be creatable).
 */
export const DATA_DIR = process.env.DATA_DIR?.trim()
  ? path.resolve(process.env.DATA_DIR.trim())
  : path.join(__dirname, "data");

/** Optional full path to gifts file; defaults to DATA_DIR/gifts.json */
export const GIFTS_FILE_PATH = process.env.GIFTS_JSON_PATH?.trim()
  ? path.resolve(process.env.GIFTS_JSON_PATH.trim())
  : path.join(DATA_DIR, "gifts.json");

/** Gift Asset API — https://github.com/GIFT-ASSET/gift_asset_api */
export const GIFT_ASSET_BASE_URL = (process.env.GIFT_ASSET_BASE_URL || "https://giftasset.gifts").replace(
  /\/+$/,
  ""
);
export const GIFT_ASSET_API_KEY = process.env.GIFT_ASSET_API_KEY?.trim() || "";
/** Header name when `GIFT_ASSET_AUTH_MODE=legacy` (otherwise ignored for named modes). */
export const GIFT_ASSET_AUTH_HEADER = process.env.GIFT_ASSET_AUTH_HEADER?.trim() || "X-API-Key";
/**
 * How the API key is sent. OpenAPI documents `X-API-Key`; some hosts expect Bearer or `?api_key=`.
 * Values: `bearer` | `x-api-key` | `api-key` | `query` | `legacy` (custom header from GIFT_ASSET_AUTH_HEADER).
 */
export const GIFT_ASSET_AUTH_MODE = process.env.GIFT_ASSET_AUTH_MODE?.trim() || "";

/** Default `telegram_gift_name` for probes (matches dev catalog "Plush Pepe" + real Gift Asset ids). */
export const GIFT_ASSET_PROBE_NAME =
  process.env.GIFT_ASSET_PROBE_NAME?.trim() || "PlushPepe-2308";
/** Collection label for `get_unique_gifts_price_list` probe. */
export const GIFT_ASSET_PROBE_COLLECTION_NAME =
  process.env.GIFT_ASSET_PROBE_COLLECTION?.trim() || "Plush Pepe";

/** Optional shared secret for POST /gifts/:listingId/metadata/refresh and POST /gifts/metadata/sync-stale */
export const METADATA_SYNC_SECRET = process.env.METADATA_SYNC_SECRET?.trim() || "";

/** Optional shared secret for POST /admin/clear-listings (dangerous). */
export const CLEAR_LISTINGS_SECRET = process.env.CLEAR_LISTINGS_SECRET?.trim() || "";

/** TON checkout */
export const MARKETPLACE_WALLET_ADDRESS = process.env.MARKETPLACE_WALLET_ADDRESS?.trim() || "";
export const TON_API_KEY = process.env.TON_API_KEY?.trim() || "";

const _floorTtl = Number.parseInt(process.env.FLOOR_CACHE_TTL_MS, 10);
/** In-memory + request coalescing TTL for Gift Asset floor rows (60s–180s). */
export const FLOOR_CACHE_TTL_MS =
  Number.isFinite(_floorTtl) && _floorTtl >= 60_000 && _floorTtl <= 180_000 ? _floorTtl : 120_000;

/** Replicate API token (preferred). Falls back to legacy `AI_UPSCALER_API_KEY`. */
export const REPLICATE_API_TOKEN =
  process.env.REPLICATE_API_TOKEN?.trim() || process.env.AI_UPSCALER_API_KEY?.trim() || "";

function parseBoolEnv(v) {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

/** Master switch for server-side Real-ESRGAN upscaling (see services/imageUpscaler.js). */
export const AI_UPSCALER_ENABLED = parseBoolEnv(process.env.AI_UPSCALER_ENABLED);

/** Legacy provider string (`replicate` | `cloudinary` | `none`). Prefer `AI_UPSCALER_ENABLED` + `REPLICATE_API_TOKEN`. */
export const AI_UPSCALER_PROVIDER = (process.env.AI_UPSCALER_PROVIDER || "none").toLowerCase().trim();
export const AI_UPSCALER_API_KEY = process.env.AI_UPSCALER_API_KEY?.trim() || "";
/** Overrides default Real-ESRGAN Replicate version id. */
export const AI_UPSCALER_MODEL = process.env.AI_UPSCALER_MODEL?.trim() || "";
export const AI_UPSCALER_CLOUD_NAME = process.env.AI_UPSCALER_CLOUD_NAME?.trim() || "";

/** nightmareai/real-esrgan — default Replicate **version** id (override with `REPLICATE_REAL_ESRGAN_VERSION` or `AI_UPSCALER_MODEL`). */
export const REPLICATE_REAL_ESRGAN_VERSION =
  process.env.REPLICATE_REAL_ESRGAN_VERSION?.trim() ||
  process.env.AI_UPSCALER_MODEL?.trim() ||
  "f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa";

const _minEdge = Number.parseInt(process.env.AI_UPSCALER_MIN_EDGE_PX, 10);
export const AI_UPSCALER_MIN_EDGE_PX =
  Number.isFinite(_minEdge) && _minEdge >= 64 && _minEdge <= 2048 ? _minEdge : 480;

const _maxDl = Number.parseInt(process.env.AI_UPSCALER_MAX_DOWNLOAD_BYTES, 10);
export const AI_UPSCALER_MAX_DOWNLOAD_BYTES =
  Number.isFinite(_maxDl) && _maxDl >= 100_000 && _maxDl <= 12_000_000 ? _maxDl : 4_500_000;

const _dlTo = Number.parseInt(process.env.AI_UPSCALER_DOWNLOAD_TIMEOUT_MS, 10);
export const AI_UPSCALER_DOWNLOAD_TIMEOUT_MS =
  Number.isFinite(_dlTo) && _dlTo >= 3000 && _dlTo <= 90_000 ? _dlTo : 12_000;

const _jobTo = Number.parseInt(process.env.AI_UPSCALER_JOB_TIMEOUT_MS, 10);
export const AI_UPSCALER_JOB_TIMEOUT_MS =
  Number.isFinite(_jobTo) && _jobTo >= 8000 && _jobTo <= 120_000 ? _jobTo : 45_000;

const _retries = Number.parseInt(process.env.AI_UPSCALER_MAX_RETRIES, 10);
export const AI_UPSCALER_MAX_RETRIES =
  Number.isFinite(_retries) && _retries >= 1 && _retries <= 5 ? _retries : 2;

/** Optional shared secret for GET /debug/providers in production (header X-Debug-Providers-Secret). */
export const DEBUG_PROVIDERS_SECRET = process.env.DEBUG_PROVIDERS_SECRET?.trim() || "";

/**
 * CORS: comma-separated origins (scheme + host, no path).
 * Set CORS_ORIGINS=https://your-app.vercel.app,https://preview.vercel.app
 * Legacy: FRONTEND_URL (single origin) still supported if CORS_ORIGINS is unset.
 */
export function getAllowedCorsOrigins() {
  const raw = process.env.CORS_ORIGINS?.trim() || process.env.FRONTEND_URL?.trim() || "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}
