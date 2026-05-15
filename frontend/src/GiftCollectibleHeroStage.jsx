import { useMemo, useSyncExternalStore } from "react";
import { buildHeroPresentationFields } from "@shared/giftHeroResolve.js";
import { GiftPatternLayer, GIFT_PATTERN_SYMBOL_IDS, hashPresentationSeed } from "./giftPatternLayer.js";

/** Telegram / Fragment collectible profile: lighter purple top → deeper purple bottom */
const TELEGRAM_PROFILE_GRADIENT =
  "linear-gradient(180deg, #c4b5fd 0%, #a78bfa 18%, #9333ea 48%, #7e22ce 72%, #6b21a8 100%)";

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
 *   children?: import("react").ReactNode;
 *   variant?: "default" | "telegramProfile";
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
  const isTelegram = variant === "telegramProfile";

  const presentation = useMemo(() => {
    if (
      !isTelegram &&
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
  }, [gift, isTelegram]);

  const bt = presentation.backdropTheme;
  const symbolPattern = presentation.symbolPattern;
  const hb = presentation.heroBackground;

  const symId =
    symbolPattern?.enabled && symbolPattern?.id && GIFT_PATTERN_SYMBOL_IDS.has(String(symbolPattern.id))
      ? String(symbolPattern.id)
      : "";

  const symColor = isTelegram
    ? "rgba(255, 255, 255, 0.92)"
    : String(bt?.symbolColor || "rgba(255,255,255,0.08)");
  const seed = String(gift?.id || gift?.listingId || "seed");

  const backdropBg = isTelegram
    ? TELEGRAM_PROFILE_GRADIENT
    : String(hb?.gradient || bt?.background || "#06080f");

  const patternOpacity = isTelegram ? (reducedMotion ? 0.08 : 0.11) : reducedMotion ? 0.32 : 0.52;

  const patternTransform = isTelegram
    ? undefined
    : `translate(${(hashPresentationSeed(seed) % 9) - 4}px, ${(hashPresentationSeed(seed + "y") % 7) - 3}px)`;

  const overlayBg = isTelegram ? "transparent" : String(hb?.overlay || bt?.overlay || "transparent");

  const vignetteBg = isTelegram
    ? "radial-gradient(ellipse 92% 80% at 50% 36%, transparent 38%, rgba(50, 20, 88, 0.2) 100%)"
    : String(hb?.vignette || bt?.vignette || "transparent");

  const glowBg = isTelegram
    ? "radial-gradient(ellipse 62% 55% at 50% 28%, rgba(255,255,255,0.14) 0%, transparent 68%)"
    : `radial-gradient(ellipse 72% 68% at 50% 46%, ${String(hb?.glowCenter || bt?.glowColor || "rgba(120,140,180,0.2)")} 0%, ${String(hb?.glowEdge || bt?.glowColorSoft || "rgba(0,0,0,0)")} 62%, transparent 78%)`;

  return (
    <div className={`giftCollectibleHero${isTelegram ? " giftCollectibleHero--telegram" : ""}`}>
      <div className="giftHeroBackdrop" style={{ background: backdropBg }} />
      {symId ? (
        <div
          className={`giftHeroPatternWrap${reducedMotion ? " giftHeroPatternWrap--reduced" : ""}${isTelegram ? " giftHeroPatternWrap--telegram" : ""}`}
          style={{
            opacity: patternOpacity,
            transform: patternTransform,
          }}
        >
          <GiftPatternLayer symbolId={symId} color={symColor} seed={seed} reducedMotion={reducedMotion} />
        </div>
      ) : null}
      <div className="giftHeroOverlayTint" style={{ background: overlayBg }} />
      <div className="giftHeroVignette giftHeroVignette--telegramAware" style={{ background: vignetteBg }} />
      <div className="giftHeroGlow giftHeroGlow--telegramAware" style={{ background: glowBg }} />
      <div className={`giftHeroBottomShade${isTelegram ? " giftHeroBottomShade--telegram" : ""}`} />
      {!backdropOnly && children != null ? <div className="giftHeroContent">{children}</div> : null}
    </div>
  );
}
