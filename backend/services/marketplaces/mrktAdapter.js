import { fetchExternalAdapter } from "./httpAdapterUtils.js";

export async function searchMrktListings(query = {}) {
  return fetchExternalAdapter({
    source: "mrkt",
    baseUrl: process.env.MRKT_API_BASE_URL,
    query,
  });
}
