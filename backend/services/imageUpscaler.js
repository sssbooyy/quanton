/**
 * Production Real-ESRGAN upscaling via Replicate (low-res Telegram gift rasters).
 * Controlled by `AI_UPSCALER_ENABLED` + `REPLICATE_API_TOKEN` (see config.js).
 * Never throws to callers — failures are logged; listings keep the original raster.
 */

import crypto from "crypto";
import axios from "axios";
import sizeOf from "image-size";
import {
  REPLICATE_API_TOKEN,
  AI_UPSCALER_ENABLED,
  AI_UPSCALER_PROVIDER,
  REPLICATE_REAL_ESRGAN_VERSION,
  AI_UPSCALER_MIN_EDGE_PX,
  AI_UPSCALER_MAX_DOWNLOAD_BYTES,
  AI_UPSCALER_DOWNLOAD_TIMEOUT_MS,
  AI_UPSCALER_JOB_TIMEOUT_MS,
  AI_UPSCALER_MAX_RETRIES,
  isProduction,
} from "../config.js";
import { Gift } from "../models/Gift.js";

const ALLOWED_CT = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/pjpeg",
  "image/x-png",
]);

/** @type {Map<string, { url: string; provider: string; expires: number }>} */
const upscaleUrlCache = new Map();
const CACHE_TTL_MS = 7 * 24 * 3600 * 1000;

function sha256(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

function cacheGet(hash) {
  const row = upscaleUrlCache.get(hash);
  if (!row) return null;
  if (row.expires < Date.now()) {
    upscaleUrlCache.delete(hash);
    return null;
  }
  return row;
}

function cacheSet(hash, url, provider) {
  if (upscaleUrlCache.size > 400) {
    const first = upscaleUrlCache.keys().next().value;
    if (first) upscaleUrlCache.delete(first);
  }
  upscaleUrlCache.set(hash, { url, provider, expires: Date.now() + CACHE_TTL_MS });
}

const UPSCALE_METADATA_SOURCES = new Set(["opengraph", "gift-asset"]);

/** Replicate Real-ESRGAN is on when explicitly enabled, or legacy `AI_UPSCALER_PROVIDER=replicate`. */
export function isReplicateUpscalerReady() {
  if (!REPLICATE_API_TOKEN) return false;
  if (!REPLICATE_REAL_ESRGAN_VERSION) return false;
  if (AI_UPSCALER_ENABLED) return true;
  if (AI_UPSCALER_PROVIDER === "replicate") return true;
  return false;
}

/** @deprecated use isReplicateUpscalerReady */
export function isUpscalerConfigured() {
  return isReplicateUpscalerReady();
}

/**
 * After `applyResolvedMetadataToGiftDocument`, align upscale bookkeeping.
 * @param {import("mongoose").Document} doc
 * @param {Record<string, unknown> & { ok: true; source?: string }} resolved
 * @returns {boolean} whether an async upscale job should be scheduled
 */
export function syncUpscaleMetadataFields(doc, resolved) {
  const source = String(resolved.source || "");
  if (!UPSCALE_METADATA_SOURCES.has(source)) {
    doc.imageOriginal = "";
    doc.imageUpscaleStatus = "none";
    doc.imageUpscaled = false;
    doc.imageUpscaleProvider = "";
    doc.imageUpscaledAt = null;
    return false;
  }

  const raster = String(resolved.imageHiRes || resolved.image || "").trim();
  doc.imageOriginal = raster;

  if (!raster.startsWith("http")) {
    doc.imageUpscaleStatus = "skipped";
    doc.imageUpscaled = false;
    doc.imageUpscaleProvider = "";
    doc.imageUpscaledAt = null;
    return false;
  }

  if (!isReplicateUpscalerReady()) {
    doc.imageUpscaleStatus = "skipped";
    doc.imageUpscaled = false;
    doc.imageUpscaleProvider = "";
    doc.imageUpscaledAt = null;
    return false;
  }

  doc.imageUpscaleStatus = "pending";
  doc.imageUpscaled = false;
  doc.imageUpscaleProvider = "";
  doc.imageUpscaledAt = null;
  return true;
}

export function scheduleGiftImageUpscale(listingId) {
  const id = String(listingId || "").trim();
  if (!id) return;
  setImmediate(() => {
    runGiftUpscaleJob(id).catch((e) => {
      console.warn("[imageUpscaler] job failed:", id, e?.message || e);
    });
  });
}

/**
 * @param {string} url
 * @returns {Promise<{ ok: true; buffer: Buffer; mime: string; width: number; height: number } | { ok: false; error: string }>}
 */
async function downloadImageSafe(url) {
  const u = String(url || "").trim();
  if (!u.startsWith("http://") && !u.startsWith("https://")) {
    return { ok: false, error: "invalid_url_scheme" };
  }

  let lastErr = "download_failed";
  for (let attempt = 0; attempt < AI_UPSCALER_MAX_RETRIES; attempt++) {
    try {
      const res = await axios.get(u, {
        responseType: "arraybuffer",
        timeout: AI_UPSCALER_DOWNLOAD_TIMEOUT_MS,
        maxContentLength: AI_UPSCALER_MAX_DOWNLOAD_BYTES,
        maxBodyLength: AI_UPSCALER_MAX_DOWNLOAD_BYTES,
        validateStatus: (s) => s >= 200 && s < 400,
        headers: {
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "User-Agent":
            "Mozilla/5.0 (compatible; QuantonMarket/1.0; +https://example.invalid) AppleWebKit/537.36",
        },
      });

      const mime = String(res.headers["content-type"] || "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      if (mime && !ALLOWED_CT.has(mime)) {
        return { ok: false, error: `disallowed_content_type:${mime}` };
      }

      const buffer = Buffer.from(res.data);
      if (buffer.length > AI_UPSCALER_MAX_DOWNLOAD_BYTES) {
        return { ok: false, error: "body_too_large" };
      }

      let dim;
      try {
        dim = sizeOf(buffer);
      } catch {
        return { ok: false, error: "probe_failed" };
      }
      const width = Number(dim.width);
      const height = Number(dim.height);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) {
        return { ok: false, error: "bad_dimensions" };
      }
      if (dim.type === "svg") {
        return { ok: false, error: "svg_skipped" };
      }

      return { ok: true, buffer, mime: mime || `image/${dim.type}`, width, height };
    } catch (e) {
      lastErr = e?.code || e?.message || "download_failed";
      if (attempt + 1 < AI_UPSCALER_MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }
  return { ok: false, error: String(lastErr) };
}

function needsUpscale(width, height) {
  const minEdge = Math.min(width, height);
  return minEdge > 0 && minEdge < AI_UPSCALER_MIN_EDGE_PX;
}

/**
 * Persist successful Replicate output. `imageUpscaleStatus` is **`done`** (legacy docs may still say `complete`).
 * Clears `imageThumb` so the grid cannot keep showing a stale low-res thumbnail URL.
 * @param {import("mongoose").Document} doc
 * @param {string} enhancedUrl
 * @param {string} provider
 */
function applyUpscaleSuccessToDoc(doc, enhancedUrl, provider) {
  doc.imageHiRes = enhancedUrl;
  doc.image = enhancedUrl;
  doc.imageUpscaled = true;
  doc.imageUpscaleProvider = provider;
  doc.imageUpscaledAt = new Date();
  doc.imageUpscaleStatus = "done";
  doc.imageThumb = "";
}

function logUpscaleVerification(listingId, enhancedUrl, provider) {
  if (isProduction) return;
  const id = String(listingId || "").trim() || "?";
  const u = String(enhancedUrl || "").trim();
  console.log(
    `[imageUpscaler] verified listing=${id} imageUpscaleStatus=done imageUpscaled=true provider=${provider} imageHiRes=${u.slice(0, 120)}${u.length > 120 ? "…" : ""}`
  );
}

/**
 * @param {string} imageUrl
 */
async function upscaleWithReplicateRealEsrgan(imageUrl) {
  const token = REPLICATE_API_TOKEN;
  const version = REPLICATE_REAL_ESRGAN_VERSION;

  if (!isProduction) {
    const v = String(version || "").trim();
    console.debug("[imageUpscaler] Replicate create prediction", {
      modelVersion: v ? `${v.slice(0, 16)}…` : "(missing)",
      hint: "override with REPLICATE_REAL_ESRGAN_VERSION",
    });
  }

  const input = { image: imageUrl };
  const create = await axios.post(
    "https://api.replicate.com/v1/predictions",
    { version, input },
    {
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 25_000,
      validateStatus: () => true,
    }
  );
  if (create.status < 200 || create.status >= 300) {
    const detail =
      typeof create.data?.detail === "string"
        ? create.data.detail
        : JSON.stringify(create.data || {}).slice(0, 400);
    throw new Error(`replicate_create_${create.status}:${detail}`);
  }

  let pred = create.data;
  const deadline = Date.now() + AI_UPSCALER_JOB_TIMEOUT_MS;
  while (pred?.status && pred.status !== "succeeded" && pred.status !== "failed" && pred.status !== "canceled") {
    if (Date.now() > deadline) {
      throw new Error("replicate_poll_timeout");
    }
    await new Promise((r) => setTimeout(r, 1200));
    const poll = await axios.get(`https://api.replicate.com/v1/predictions/${pred.id}`, {
      headers: { Authorization: `Token ${token}` },
      timeout: 20_000,
    });
    pred = poll.data;
  }

  if (pred?.status !== "succeeded") {
    throw new Error(`replicate_status_${pred?.status || "unknown"}`);
  }

  const out = pred.output;
  const url = Array.isArray(out) ? out[0] : typeof out === "string" ? out : "";
  if (!url || !String(url).startsWith("http")) {
    throw new Error("replicate_bad_output");
  }
  return String(url).trim();
}

/**
 * @param {string} originalUrl
 * @returns {Promise<{ ok: true; enhancedUrl: string; provider: string } | { ok: false; reason: string }>}
 */
export async function tryUpscaleRemoteImage(originalUrl) {
  const url = String(originalUrl || "").trim();
  if (!url.startsWith("http")) return { ok: false, reason: "bad_url" };

  if (!isReplicateUpscalerReady()) {
    return { ok: false, reason: "not_configured" };
  }

  const hash = sha256(url);
  const cached = cacheGet(hash);
  if (cached?.url) {
    return { ok: true, enhancedUrl: cached.url, provider: cached.provider };
  }

  const dl = await downloadImageSafe(url);
  if (!dl.ok) {
    console.warn("[imageUpscaler] download/skip:", url.slice(0, 80), dl.error);
    return { ok: false, reason: dl.error };
  }

  if (!needsUpscale(dl.width, dl.height)) {
    return { ok: false, reason: "already_hd" };
  }

  try {
    const enhancedUrl = await upscaleWithReplicateRealEsrgan(url);
    const provider = "replicate/real-esrgan";
    cacheSet(hash, enhancedUrl, provider);
    return { ok: true, enhancedUrl, provider };
  } catch (e) {
    console.warn("[imageUpscaler] Replicate Real-ESRGAN error:", e?.message || e);
    return { ok: false, reason: String(e?.message || "provider_error") };
  }
}

/**
 * Background job: load listing, upscale OG raster if still pending.
 * @param {string} listingId
 */
export async function runGiftUpscaleJob(listingId) {
  const doc = await Gift.findOne({ listingId });
  if (!doc) return;
  const src = String(doc.metadataSource || "");
  if (!UPSCALE_METADATA_SOURCES.has(src)) return;
  if (doc.imageUpscaleStatus !== "pending") return;

  const originalUrl = String(doc.imageOriginal || doc.imageHiRes || doc.image || "").trim();
  if (!originalUrl.startsWith("http")) {
    doc.imageUpscaleStatus = "failed";
    await doc.save();
    return;
  }

  const hash = sha256(originalUrl);
  const cached = cacheGet(hash);
  if (cached?.url) {
    applyUpscaleSuccessToDoc(doc, cached.url, cached.provider);
    await doc.save();
    logUpscaleVerification(listingId, cached.url, cached.provider);
    return;
  }

  const result = await tryUpscaleRemoteImage(originalUrl);
  if (result.ok) {
    applyUpscaleSuccessToDoc(doc, result.enhancedUrl, result.provider);
    await doc.save();
    logUpscaleVerification(listingId, result.enhancedUrl, result.provider);
    return;
  }

  if (result.reason === "already_hd") {
    doc.imageUpscaleStatus = "skipped";
    doc.imageUpscaled = false;
    await doc.save();
    return;
  }

  doc.imageUpscaleStatus = "failed";
  doc.imageUpscaled = false;
  await doc.save();
}
