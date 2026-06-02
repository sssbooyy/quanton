import { fetchExternalAdapter } from "./httpAdapterUtils.js";

export async function searchPortalsListings(query = {}) {
  return fetchExternalAdapter({
    source: "portals",
    baseUrl: process.env.PORTALS_API_BASE_URL,
    query,
  });
}
