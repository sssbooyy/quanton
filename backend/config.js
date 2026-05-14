import path from "path";
import { fileURLToPath } from "url";

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
/** Header name for the API key (default matches common Gift Asset deployments). */
export const GIFT_ASSET_AUTH_HEADER = process.env.GIFT_ASSET_AUTH_HEADER?.trim() || "X-API-Key";

/** Optional shared secret for POST /gifts/metadata/sync-stale */
export const METADATA_SYNC_SECRET = process.env.METADATA_SYNC_SECRET?.trim() || "";

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
