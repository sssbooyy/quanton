import { buildHeroPresentationFieldsFromGift } from "../../shared/giftHeroResolve.js";

/**
 * Attach collectible hero presentation for Mini App / web (backdrop + pattern metadata).
 * @param {Record<string, unknown>} base
 * @param {Record<string, unknown>} plain
 */
export function attachHeroPresentationToApiResponse(base, plain) {
  const fields = buildHeroPresentationFieldsFromGift(plain);
  base.backdropTheme = fields.backdropTheme;
  base.symbolPattern = fields.symbolPattern;
  base.heroBackground = fields.heroBackground;
}
