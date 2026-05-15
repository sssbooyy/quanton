/**
 * Parse Telegram collectible pages (t.me/nft/Collection-Number) for traits + preview assets.
 */

import { absolutizeAssetUrl } from "./openGraphResolve.js";

const FETCH_TIMEOUT_MS = 14_000;
const MAX_HTML_BYTES = 1_200_000;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function decodeBasicEntities(s) {
  return String(s ?? "")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/gi, " ");
}

function pickMetaContent(html, prop) {
  const esc = prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${esc}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${esc}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${esc}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${esc}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeBasicEntities(m[1].trim());
  }
  return "";
}

/**
 * Strip HTML tags and trailing rarity % from table cells.
 * @param {string} raw
 */
export function cleanTelegramAttributeValue(raw) {
  let s = decodeBasicEntities(String(raw ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  s = s.replace(/\s+\d+(?:\.\d+)?\s*%?\s*$/i, "").trim();
  return s;
}

/**
 * @param {string} html
 * @returns {Record<string, string>}
 */
export function parseTelegramGiftAttributeTable(html) {
  /** @type {Record<string, string>} */
  const out = {};
  const re = /<tr>\s*<th>\s*([^<]+?)\s*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const label = cleanTelegramAttributeValue(m[1]);
    const value = cleanTelegramAttributeValue(m[2]);
    if (!label || !value) continue;
    const key = label.toLowerCase();
    if (key === "model") out.model = value;
    else if (key === "symbol") out.symbol = value;
    else if (key === "backdrop") out.backdrop = value;
    else if (key === "owner") out.owner = value;
    else if (key === "quantity") out.quantity = value;
    else if (key === "value" || key === "blockchain") out.blockchain = value;
    else if (key === "availability") out.availability = value;
    else out[key.replace(/\s+/g, "_")] = value;
  }
  return out;
}

/**
 * @param {string} description
 */
function parseDescriptionAttributes(description) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of String(description || "").split(/\n+/)) {
    const m = line.trim().match(/^([A-Za-z][A-Za-z\s]*?):\s*(.+)$/);
    if (!m) continue;
    const k = m[1].trim().toLowerCase();
    const v = cleanTelegramAttributeValue(m[2]);
    if (k === "model") out.model = v;
    else if (k === "symbol") out.symbol = v;
    else if (k === "backdrop") out.backdrop = v;
    else if (k === "owner") out.owner = v;
  }
  return out;
}

/**
 * @param {string} html
 * @param {string} pageUrl
 */
function extractTelegramStickerUrl(html, pageUrl) {
  const m = html.match(
    /<source[^>]+type=["']application\/x-tgsticker["'][^>]+srcset=["'](https?:\/\/[^"']+)["']/i
  );
  if (m?.[1]) return absolutizeAssetUrl(pageUrl, m[1].trim());
  const m2 = html.match(/srcset=["'](https:\/\/cdn[^"']+file\/sticker[^"']+)["']/i);
  if (m2?.[1]) return m2[1].trim();
  return "";
}

/**
 * @param {string} pageUrl
 * @param {string} html
 */
async function fetchTelegramNftHtml(pageUrl) {
  let url;
  try {
    url = new URL(pageUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.href, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > MAX_HTML_BYTES ? buf.slice(0, MAX_HTML_BYTES) : buf;
    return new TextDecoder("utf-8", { fatal: false }).decode(slice);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} nftSlug
 * @param {string} title
 */
function collectionFromTitle(nftSlug, title) {
  const t = String(title || "").trim();
  if (t && !/^collectible\b/i.test(t) && !/^telegram\b/i.test(t)) {
    return t.replace(/\s+#\d+\s*$/i, "").trim() || t;
  }
  const m = String(nftSlug || "").match(/^([A-Za-z][A-Za-z0-9]*)-\d+$/);
  if (!m) return "";
  return m[1]
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
}

/**
 * Fetch + parse a Telegram NFT preview page.
 * @param {string} pageUrl
 * @returns {Promise<{
 *   title: string;
 *   image: string;
 *   siteName: string;
 *   collection: string;
 *   model: string;
 *   symbol: string;
 *   backdrop: string;
 *   owner: string;
 *   quantity: string;
 *   availability: string;
 *   blockchain: string;
 *   stickerUrl: string;
 *   nftSlug: string;
 *   traits: { key: string; value: string }[];
 * } | null>}
 */
export async function fetchTelegramNftPage(pageUrl) {
  const html = await fetchTelegramNftHtml(pageUrl);
  if (!html) return null;

  let nftSlug = "";
  try {
    const u = new URL(pageUrl);
    const m = u.pathname.match(/\/nft\/([^/?#]+)/i);
    if (m) nftSlug = decodeURIComponent(m[1]);
  } catch {
    /* ignore */
  }

  const title =
    pickMetaContent(html, "og:title") ||
    pickMetaContent(html, "twitter:title") ||
    (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]
      ? decodeBasicEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)[1].trim())
      : "");

  const image =
    pickMetaContent(html, "og:image") ||
    pickMetaContent(html, "og:image:url") ||
    pickMetaContent(html, "twitter:image") ||
    "";
  const siteName = pickMetaContent(html, "og:site_name") || "";
  const description =
    pickMetaContent(html, "og:description") || pickMetaContent(html, "twitter:description") || "";

  const tableAttrs = parseTelegramGiftAttributeTable(html);
  const descAttrs = parseDescriptionAttributes(description);
  const attrs = { ...descAttrs, ...tableAttrs };

  const collection = collectionFromTitle(nftSlug, title) || "";

  const traits = [];
  const pushTrait = (key, value) => {
    const v = String(value ?? "").trim();
    if (!v) return;
    traits.push({ key, value: v });
  };
  pushTrait("model", attrs.model);
  pushTrait("symbol", attrs.symbol);
  pushTrait("backdrop", attrs.backdrop);
  pushTrait("owner", attrs.owner);
  pushTrait("quantity", attrs.quantity);
  pushTrait("availability", attrs.availability);
  pushTrait("blockchain", attrs.blockchain);
  if (nftSlug) pushTrait("nftSlug", nftSlug);

  return {
    title: title.trim(),
    image: absolutizeAssetUrl(pageUrl, image).trim(),
    siteName: siteName.trim(),
    collection,
    model: String(attrs.model || "").trim(),
    symbol: String(attrs.symbol || "").trim(),
    backdrop: String(attrs.backdrop || "").trim(),
    owner: String(attrs.owner || "").trim(),
    quantity: String(attrs.quantity || "").trim(),
    availability: String(attrs.availability || attrs.quantity || "").trim(),
    blockchain: String(attrs.blockchain || "").trim(),
    stickerUrl: extractTelegramStickerUrl(html, pageUrl),
    nftSlug,
    traits,
  };
}
