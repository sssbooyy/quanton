/**
 * Minimal Gift Asset HTTP client (shared by metadata + floor providers).
 * @see https://github.com/GIFT-ASSET/gift_asset_api
 */

import axios from "axios";
import { GIFT_ASSET_API_KEY, GIFT_ASSET_AUTH_HEADER, GIFT_ASSET_BASE_URL } from "../config.js";

/**
 * @param {string} name Gift Asset `name` (e.g. EasterEgg-1)
 * @returns {Promise<object | null>}
 */
export async function fetchGiftAssetByName(name) {
  if (!GIFT_ASSET_API_KEY) return null;
  const base = GIFT_ASSET_BASE_URL.replace(/\/+$/, "");
  const url = `${base}/api/v1/gifts/get_gift_by_name`;
  try {
    const res = await axios.get(url, {
      params: { name },
      headers: { [GIFT_ASSET_AUTH_HEADER]: GIFT_ASSET_API_KEY },
      timeout: 18_000,
      validateStatus: () => true,
    });
    if (res.status !== 200 || !res.data || typeof res.data !== "object") return null;
    if (res.data.code && res.data.message) return null;
    return res.data;
  } catch (e) {
    console.warn("[giftAssetClient] request failed:", e?.message || e);
    return null;
  }
}
