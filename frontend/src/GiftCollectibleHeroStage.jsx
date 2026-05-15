import { useMemo, useSyncExternalStore } from "react";
import {
  buildHeroPresentationFieldsFromGift,
  resolveCollectibleHeroPresentation,
} from "@shared/giftHeroResolve.js";
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
 * Collectible hero: gradient + symbol pattern from gift metadata (same themes as API / Portals-style).
 * @param {{
 *   gift: Record<string, unknown>;
 *   children?: import("react").ReactNode;
 *   variant?: "default" | "collectibleProfile";
 *   backdropOnly?: boolean;
 * }} props
 */
export default function GiftCollectibleHeroStage({
  gift,
  children,
  variant = "default",
  backdropOnly = false,
}) {
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);
  const isProfile = variant === "collectibleProfile";

  const presentation = useMemo(() => {
    if (isProfile) {
      return resolveCollectibleHeroPresentation(gift);
    }
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
      ...buildHeroPresentationFieldsFromGift(gift),
      fromApi: false,
    };
  }, [gift, isProfile]);

  const bt = presentation.backdropTheme;
  const symbolPattern = presentation.symbolPattern;
  const hb = presentation.heroBackground;

  const symId =
    symbolPattern?.enabled && symbolPattern?.id && GIFT_PATTERN_SYMBOL_IDS.has(String(symbolPattern.id))
      ? String(symbolPattern.id)
      : "";

  const symColor = String(bt?.symbolColor || "rgba(255,255,255,0.1)");
  const seed = String(gift?.id || gift?.listingId || "seed");

  const backdropBg = String(hb?.gradient || bt?.background || "#06080f");

  const patternOpacity = isProfile ? (reducedMotion ? 0.08 : 0.1) : reducedMotion ? 0.32 : 0.52;

  const patternTransform = isProfile
    ? undefined
    : `translate(${(hashPresentationSeed(seed) % 9) - 4}px, ${(hashPresentationSeed(seed + "y") % 7) - 3}px)`;

  const overlayBg = String(hb?.overlay || bt?.overlay || "transparent");

  const vignetteBg = String(hb?.vignette || bt?.vignette || "transparent");

  const glowBg = `radial-gradient(ellipse 72% 68% at 50% 46%, ${String(hb?.glowCenter || bt?.glowColor || "rgba(120,140,180,0.2)")} 0%, ${String(hb?.glowEdge || bt?.glowColorSoft || "rgba(0,0,0,0)")} 62%, transparent 78%)`;

  return (
    <div className={`giftCollectibleHero${isProfile ? " giftCollectibleHero--profile" : ""}`}>
      <div className="giftHeroBackdrop" style={{ background: backdropBg }} />
      {symId ? (
        <div
          className={`giftHeroPatternWrap${reducedMotion ? " giftHeroPatternWrap--reduced" : ""}${isProfile ? " giftHeroPatternWrap--profile" : ""}`}
          style={{
            opacity: patternOpacity,
            transform: patternTransform,
          }}
        >
          <GiftPatternLayer symbolId={symId} color={symColor} seed={seed} reducedMotion={reducedMotion} />
        </div>
      ) : null}
      <div className="giftHeroOverlayTint" style={{ background: overlayBg }} />
      <div className="giftHeroVignette giftHeroVignette--profileAware" style={{ background: vignetteBg }} />
      <div className="giftHeroGlow giftHeroGlow--profileAware" style={{ background: glowBg }} />
      <div className={`giftHeroBottomShade${isProfile ? " giftHeroBottomShade--profile" : ""}`} />
      {!backdropOnly && children != null ? <div className="giftHeroContent">{children}</div> : null}
    </div>
  );
}
