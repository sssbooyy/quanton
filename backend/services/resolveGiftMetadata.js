import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import path from "path";
import { GIFTS_FILE_PATH } from "../config.js";

/**
 * Resolve Telegram gift link / gift ID → listing metadata.
 *
 * Today: loads known rows from `backend/data/gifts.json` (same catalog as Mongo seed)
 * and matches by `gift_starter_*` id embedded in the pasted string. Unknown links return
 * a generic placeholder so the flow never hard-fails while we wire real Telegram/TON APIs.
 *
 * @param {string} giftLink
 * @returns {Promise<
 *   | { ok: true; name: string; collection: string; image: string; rarity: number; floorTon: number; traits: object[]; source: "manual-resolver" }
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
  return crypto.createHash("sha256").update(String(link).slice(0, 200), "utf8").digest("hex").slice(0, 20);
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
