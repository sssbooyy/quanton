/**
 * Fetch a public HTML page and extract common OpenGraph / Twitter Card tags.
 * Used for Telegram NFT preview pages (t.me/nft/...).
 */

const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 900_000;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * @param {string} html
 * @param {string} prop e.g. og:title
 */
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

function decodeBasicEntities(s) {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/gi, " ");
}

/**
 * @param {string} pageUrl
 * @param {string} imageRef
 */
export function absolutizeAssetUrl(pageUrl, imageRef) {
  const t = String(imageRef || "").trim();
  if (!t) return "";
  if (t.startsWith("//")) return `https:${t}`;
  try {
    return new URL(t, pageUrl).href;
  } catch {
    return t;
  }
}

function pickDocumentTitle(html) {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? decodeBasicEntities(m[1].trim()) : "";
}

/**
 * @param {string} pageUrl absolute https URL
 * @returns {Promise<{ title: string; image: string; siteName: string } | null>}
 */
export async function fetchOpenGraphMeta(pageUrl) {
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
    const html = new TextDecoder("utf-8", { fatal: false }).decode(slice);

    const title =
      pickMetaContent(html, "og:title") ||
      pickMetaContent(html, "twitter:title") ||
      pickDocumentTitle(html);
    const image =
      pickMetaContent(html, "og:image") ||
      pickMetaContent(html, "og:image:url") ||
      pickMetaContent(html, "twitter:image") ||
      pickMetaContent(html, "twitter:image:src");
    const siteName = pickMetaContent(html, "og:site_name") || pickMetaContent(html, "twitter:site");

    if (!title && !image) return null;

    return {
      title: title.trim(),
      image: absolutizeAssetUrl(url.href, image).trim(),
      siteName: siteName.trim(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
