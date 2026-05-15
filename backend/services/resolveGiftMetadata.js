/**
 * @deprecated Import from `./metadataProvider.js` instead. Kept for stable import paths.
 */
export {
  resolveGiftMetadata,
  normalizeTelegramPageUrl,
  extractTelegramNftSlugFromUrl,
  extractGiftAssetName,
  mapGiftAssetPayloadToResult,
} from "./metadataProvider.js";

export {
  fetchLiveCollectionFloor,
  fetchLiveCollectionFloorForCandidates,
  resolveCollectionNameCandidates,
} from "./giftAssetPublicClient.js";
