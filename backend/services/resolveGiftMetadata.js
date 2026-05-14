import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import path from "path";
import { GIFTS_FILE_PATH } from "../config.js";
import { fetchOpenGraphMeta } from "./openGraphResolve.js";

/**
 * Resolve Telegram gift link / gift ID → listing metadata.
 *
 * Resolution order:
 * 1. Seed catalog (`backend/data/gifts.json`) for known `gift_starter_*` ids.
 * 2. Telegram NFT pages (`t.me/nft/...`) via OpenGraph (`og:title`, `og:image`).
 * 3. Generic placeholder (deterministic image) for unknown links.
 *
 * @param {string} giftLink
 * @returns {Promise<
 *   | {
 *       ok: true;
 *       name: string;
 *       collection: string;
 *       image: string;
 *       rarity: number;
 *       floorTon: number;
 *       traits: object[];
 *       source: "manual-resolver" | "opengraph";
 *     }
 *   | { ok: false; error: string }
 * >}
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let catalogById = null;

function loadCatalogMap() {
  if (catalogById) return catalogById;
  catalogById = new Map();
  const pathsToTry = [GIFTS_FILE_PATH, path.join(__dirname, "../data/gifts.json")];
  for (const p of pathsToTry) {
    try {
      if (!fs.existsSync(p)) continue;
      const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
      if (!Array.isArray(raw)) continue;
      for (const row of raw) {
        if (!row?.id) continue;
        catalogById.set(String(row.id).toLowerCase(), row);
      }
      if (catalogById.size) break;
    } catch {
      /* try next path */
    }
  }
  return catalogById;
}

/**
 * @param {string} giftLink
 * @returns {string[]}
 */
function extractCandidateIds(giftLink) {
  const s = String(giftLink || "").trim();
  if (!s) return [];
  const out = new Set();
  out.add(s);
  out.add(s.toLowerCase());

  const starter = s.match(/gift_starter_\d+/i);
  if (starter) {
    out.add(starter[0]);
    out.add(starter[0].toLowerCase());
  }

  const slashId = s.match(/\/(gift_starter_\d+)\b/i);
  if (slashId) {
    out.add(slashId[1]);
    out.add(slashId[1].toLowerCase());
  }

  const digits = s.match(/\b(\d{3,})\b/);
  if (digits) out.add(digits[1]);

  return [...out];
}

function slugForPlaceholder(link) {
  return crypto
    .createHash("sha256")
    .update(String(link).slice(0, 200), "utf8")
    .digest("hex")
    .slice(0, 20);
}

/**
 * @param {string} raw user paste
 * @returns {string | null} canonical https URL when parseable
 */
export function normalizeTelegramPageUrl(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  try {
    if (/^https?:\/\//i.test(t)) {
      return new URL(t).href;
    }
  } catch {
    return null;
  }
  if (/^(t\.me|telegram\.me)\//i.test(t)) {
    try {
      return new URL(`https://${t}`).href;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * @param {string} absUrl
 * @returns {string | null} NFT path segment after /nft/
 */
export function extractTelegramNftSlugFromUrl(absUrl) {
  try {
    const u = new URL(absUrl);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "t.me" && host !== "telegram.me") return null;
    const m = u.pathname.match(/^\/nft\/([^/?#]+)/i);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function humanizeCompactIdentifier(s) {
  if (!s) return "";
  return s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").trim();
}

/**
 * @param {string} nftSlug e.g. LushBouquet-6509
 */
function collectionAndDisplayNameFromNftSlug(nftSlug) {
  const slug = String(nftSlug || "").trim();
  if (!slug) {
    return { collection: "Telegram NFT", displayName: "Telegram NFT" };
  }
  const parts = slug.split("-");
  const last = parts[parts.length - 1];
  if (/^\d+$/.test(last) && parts.length > 1) {
    const collPart = parts.slice(0, -1).join("");
    const collection = humanizeCompactIdentifier(collPart) || "Telegram NFT";
    const displayName = `${collection} #${last}`;
    return { collection, displayName };
  }
  const collection = humanizeCompactIdentifier(slug) || "Telegram NFT";
  return { collection, displayName: collection };
}

export async function resolveGiftMetadata(giftLink) {
  const raw = String(giftLink ?? "").trim();
  if (!raw) {
    return { ok: false, error: "Gift link or gift ID is required." };
  }

  const catalog = loadCatalogMap();
  const candidates = extractCandidateIds(raw);

  for (const key of candidates) {
    const row = catalog.get(key.toLowerCase());
    if (row?.name && row?.image) {
      const rarity = Number(row.rarity);
      const floorTon = Number(row.floorTon);
      return {
        ok: true,
        name: String(row.name),
        collection: String(row.collection ?? "Telegram Gifts"),
        image: String(row.image).trim(),
        rarity: Number.isFinite(rarity) && rarity >= 1 && rarity <= 100 ? Math.round(rarity) : 50,
        floorTon: Number.isFinite(floorTon) && floorTon > 0 ? floorTon : 100,
        traits: [
          { key: "catalogId", value: String(row.id) },
          { key: "resolver", value: "gifts-json-catalog" },
        ],
        source: "manual-resolver",
      };
    }
  }

  const pageUrl = normalizeTelegramPageUrl(raw);
  const nftSlug = pageUrl ? extractTelegramNftSlugFromUrl(pageUrl) : null;

  if (pageUrl && nftSlug) {
    const { collection: slugCollection, displayName } = collectionAndDisplayNameFromNftSlug(nftSlug);
    const og = await fetchOpenGraphMeta(pageUrl);

    if (og && (og.title || og.image)) {
      const name = (og.title || displayName).trim() || displayName;
      let image = (og.image || "").trim();
      if (!image) {
        image = `https://picsum.photos/seed/${slugForPlaceholder(`${pageUrl}:${nftSlug}`)}/640/640`;
      }
      const site = (og.siteName && og.siteName.trim()) || "";
      const collection =
        site && site.toLowerCase() !== "telegram"
          ? site
          : slugCollection || "Telegram NFT";

      return {
        ok: true,
        name,
        collection,
        image,
        rarity: 58,
        floorTon: 120,
        traits: [
          { key: "giftLink", value: pageUrl },
          { key: "nftSlug", value: nftSlug },
          { key: "resolver", value: "opengraph" },
          ...(og.title ? [{ key: "og:title", value: og.title }] : []),
          ...(og.image ? [{ key: "og:image", value: og.image }] : []),
        ],
        source: "opengraph",
      };
    }

    const seed = slugForPlaceholder(pageUrl);
    return {
      ok: true,
      name: displayName,
      collection: slugCollection,
      image: `https://picsum.photos/seed/${seed}/640/640`,
      rarity: 58,
      floorTon: 120,
      traits: [
        { key: "giftLink", value: pageUrl },
        { key: "nftSlug", value: nftSlug },
        { key: "resolver", value: "telegram-nft-slug-fallback" },
      ],
      source: "manual-resolver",
    };
  }

  const seed = slugForPlaceholder(raw);
  return {
    ok: true,
    name: "Telegram Gift",
    collection: "Telegram Gifts",
    image: `https://picsum.photos/seed/${seed}/640/640`,
    rarity: 62,
    floorTon: 120,
    traits: [{ key: "resolver", value: "generic-placeholder" }],
    source: "manual-resolver",
  };
}
