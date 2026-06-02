import { fetchExternalAdapter } from "./httpAdapterUtils.js";

export async function searchTonnelListings(query = {}) {
  return fetchExternalAdapter({
    source: "tonnel",
    baseUrl: process.env.TONNEL_API_BASE_URL,
    query,
  });
}
