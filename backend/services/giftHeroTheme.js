import { buildHeroPresentationFields } from "../../shared/giftHeroResolve.js";

/**
 * Attach collectible hero presentation for Mini App / web (backdrop + pattern metadata).
 * @param {Record<string, unknown>} base
 * @param {Record<string, unknown>} plain
 */
export function attachHeroPresentationToApiResponse(base, plain) {
  const fields = buildHeroPresentationFields({
    backdrop: String(plain.backdrop || ""),
    symbol: String(plain.symbol || ""),
    model: String(plain.model || ""),
    collection: String(plain.collection || ""),
    listingId: String(plain.listingId || ""),
  });
  base.backdropTheme = fields.backdropTheme;
  base.symbolPattern = fields.symbolPattern;
  base.heroBackground = fields.heroBackground;
}
