import { useMemo, useSyncExternalStore } from "react";
import { buildHeroPresentationFields } from "@shared/giftHeroResolve.js";
import { GiftPatternLayer, GIFT_PATTERN_SYMBOL_IDS, hashPresentationSeed } from "./giftPatternLayer.js";

function subscribeReducedMotion() {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const fn = () => {};
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
}

function getReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    ? true
    : false;
}

/**
 * Fragment-style hero: gradient backdrop, tiled symbol atmosphere, vignette, glow behind asset.
 * @param {{
 *   gift: Record<string, unknown>;
 *   children: import("react").ReactNode;
 * }} props
 */
export default function GiftCollectibleHeroStage({ gift, children }) {
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);

  const presentation = useMemo(() => {
    if (
      gift?.backdropTheme &&
      typeof gift.backdropTheme === "object" &&
      gift?.heroBackground &&
      typeof gift.heroBackground === "object"
    ) {
      return {
        backdropTheme: /** @type {Record<string, unknown>} */ (gift.backdropTheme),
        symbolPattern: /** @type {Record<string, unknown>} */ (gift.symbolPattern || {}),
        heroBackground: /** @type {Record<string, unknown>} */ (gift.heroBackground),
        fromApi: true,
      };
    }
    return {
      ...buildHeroPresentationFields({
        backdrop: String(gift?.backdrop || ""),
        symbol: String(gift?.symbol || ""),
        model: String(gift?.model || ""),
        collection: String(gift?.collection || ""),
        listingId: String(gift?.id || gift?.listingId || ""),
      }),
      fromApi: false,
    };
  }, [gift]);

  const bt = presentation.backdropTheme;
  const symbolPattern = presentation.symbolPattern;
  const hb = presentation.heroBackground;

  const symId =
    symbolPattern?.enabled && symbolPattern?.id && GIFT_PATTERN_SYMBOL_IDS.has(String(symbolPattern.id))
      ? String(symbolPattern.id)
      : "";

  const symColor = String(bt?.symbolColor || "rgba(255,255,255,0.08)");
  const seed = String(gift?.id || gift?.listingId || "seed");

  return (
    <div className="giftCollectibleHero">
      <div
        className="giftHeroBackdrop"
        style={{ background: String(hb?.gradient || bt?.background || "#06080f") }}
      />
      {symId ? (
        <div
          className={`giftHeroPatternWrap${reducedMotion ? " giftHeroPatternWrap--reduced" : ""}`}
          style={
            reducedMotion
              ? { opacity: 0.32 }
              : {
                  opacity: 0.52,
                  transform: `translate(${(hashPresentationSeed(seed) % 9) - 4}px, ${(hashPresentationSeed(seed + "y") % 7) - 3}px)`,
                }
          }
        >
          <GiftPatternLayer symbolId={symId} color={symColor} seed={seed} reducedMotion={reducedMotion} />
        </div>
      ) : null}
      <div
        className="giftHeroOverlayTint"
        style={{ background: String(hb?.overlay || bt?.overlay || "transparent") }}
      />
      <div
        className="giftHeroVignette"
        style={{ background: String(hb?.vignette || bt?.vignette || "transparent") }}
      />
      <div
        className="giftHeroGlow"
        style={{
          background: `radial-gradient(ellipse 72% 68% at 50% 46%, ${String(hb?.glowCenter || bt?.glowColor || "rgba(120,140,180,0.2)")} 0%, ${String(hb?.glowEdge || bt?.glowColorSoft || "rgba(0,0,0,0)")} 62%, transparent 78%)`,
        }}
      />
      <div className="giftHeroBottomShade" />
      <div className="giftHeroContent">{children}</div>
    </div>
  );
}
