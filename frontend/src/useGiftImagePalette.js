import { useEffect, useMemo, useState } from "react";
import { extractGiftImagePalette, hexToRgba } from "./giftImagePalette.js";

/**
 * @typedef {{
 *   dominantColor: string;
 *   secondaryColor: string;
 *   accentColor: string;
 *   isDark: boolean;
 *   isLight: boolean;
 * }} GiftImagePaletteEnhancement
 */

/**
 * After the active raster URL loads, extract palette and expose CSS vars + card glow styles.
 * @param {string} imageUrl busted or raw https URL from `useGiftMainRasterImage`
 */
export function useGiftImagePalette(imageUrl) {
  const url = useMemo(() => (typeof imageUrl === "string" ? imageUrl.trim() : ""), [imageUrl]);

  const [state, setState] = useState(() => ({
    enhancement: /** @type {GiftImagePaletteEnhancement | null} */ (null),
    raw: {
      dominantColor: "",
      secondaryColor: "",
      accentColor: "",
      isDark: false,
      isLight: false,
      paletteSource: /** @type {"image" | "fallback"} */ ("fallback"),
    },
  }));

  useEffect(() => {
    let cancelled = false;
    if (!url) {
      setState({
        enhancement: null,
        raw: {
          dominantColor: "",
          secondaryColor: "",
          accentColor: "",
          isDark: false,
          isLight: false,
          paletteSource: "fallback",
        },
      });
      return undefined;
    }

    extractGiftImagePalette(url).then((r) => {
      if (cancelled) return;
      if (r.paletteSource !== "image") {
        setState({ enhancement: null, raw: r });
        return;
      }
      setState({
        enhancement: {
          dominantColor: r.dominantColor,
          secondaryColor: r.secondaryColor,
          accentColor: r.accentColor,
          isDark: r.isDark,
          isLight: r.isLight,
        },
        raw: r,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const { enhancement, raw } = state;

  const cssVars = useMemo(
    () =>
      enhancement
        ? {
            "--gift-dominant": enhancement.dominantColor,
            "--gift-secondary": enhancement.secondaryColor,
            "--gift-accent": enhancement.accentColor,
          }
        : undefined,
    [enhancement],
  );

  const cardBlurGlowStyle = useMemo(
    () =>
      enhancement
        ? {
            background: `radial-gradient(circle at 50% 40%, ${hexToRgba(enhancement.dominantColor, 0.22)} 0%, ${hexToRgba(enhancement.accentColor, 0.14)} 28%, ${hexToRgba(enhancement.secondaryColor, 0.08)} 48%, transparent 72%)`,
          }
        : undefined,
    [enhancement],
  );

  const cardRadialStyle = useMemo(
    () =>
      enhancement
        ? {
            background: `radial-gradient(ellipse 100% 82% at 50% 36%, ${hexToRgba(enhancement.accentColor, 0.11)} 0%, transparent 58%)`,
          }
        : undefined,
    [enhancement],
  );

  return {
    enhancement,
    paletteSource: raw.paletteSource,
    cssVars,
    cardBlurGlowStyle,
    cardRadialStyle,
    debug: {
      extractedDominantColor: raw.dominantColor || "—",
      extractedSecondaryColor: raw.secondaryColor || "—",
      extractedAccentColor: raw.accentColor || "—",
      paletteSource: raw.paletteSource,
    },
  };
}
