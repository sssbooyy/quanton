/**
 * Low-level Gift Asset HTTP GET (auth via {@link ./giftAssetAuth.js}).
 */

import axios from "axios";
import { GIFT_ASSET_BASE_URL } from "../config.js";
import { buildGiftAssetAuthLayers } from "./giftAssetAuth.js";

/**
 * @param {string} path Absolute path on API host, e.g. `/api/v1/gifts/get_gift_by_name`
 * @param {Record<string, string | number | boolean | undefined>} [queryParams]
 * @returns {Promise<import("axios").AxiosResponse>}
 */
export async function giftAssetGet(path, queryParams = {}) {
  const base = GIFT_ASSET_BASE_URL.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${p}`;
  const { headers, extraQuery } = buildGiftAssetAuthLayers();
  return axios.get(url, {
    params: { ...queryParams, ...extraQuery },
    headers,
    timeout: 18_000,
    validateStatus: () => true,
  });
}
