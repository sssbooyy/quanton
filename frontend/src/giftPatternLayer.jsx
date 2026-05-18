import { useMemo, memo, useId } from "react";

/** Seeded 0..1 */
function seeded01(seed, i, salt) {
  const x = Math.sin((seed + salt * 997) * 8887 + i * 7919) * 10000;
  return x - Math.floor(x);
}

/** @param {string} seedStr */
export function hashPresentationSeed(seedStr) {
  let h = 2166136261;
  const s = String(seedStr || "0");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 10000000;
}

/** @typedef {"card" | "detail"} ScatterSurface */

/** Nominal hero square size (px) for collision math; matches ~card / modal width scale. */
const SCATTER_BOX_PX = 512;

/**
 * Portals / Telegram-style scattered raster symbols: staggered orbit-grid, center exclusion, one shared angle.
 * Non-overlapping: min center distance >= (sizeA + sizeB) * spacingK (deterministic K in [0.55, 0.67]).
 * @param {ScatterSurface} surface
 * @param {boolean} reducedMotion
 * @returns {{ globalAngleDeg: number; instances: { xPct: number; yPct: number; sizePx: number; opacityMul: number }[] }}
 */
function buildRasterScatterLayout(surface, reducedMotion) {
  const isCard = surface === "card";
  const layoutSeedStr = `quanton-symbol-layout:${surface}:${reducedMotion ? "reduced" : "standard"}`;
  const seedN = hashPresentationSeed(layoutSeedStr);
  /** Normalized Euclidean distance from center; skip below this (clean collectible zone). */
  const exclusion = isCard ? 0.17 : 0.2;
  /** Fixed staggered rows; density changes only for reduced motion. */
  const count = reducedMotion ? (isCard ? 12 : 14) : isCard ? 20 : 24;
  /** Min-distance multiplier keeps large symbols from visually stacking. */
  const spacingK = 0.55 + seeded01(seedN, 0, 88) * 0.12;

  /** One global angle: every gift uses the same orientation; only symbol artwork changes. */
  const globalAngleDeg = -23;

  /** @type {{ x: number; y: number; xPct: number; yPct: number; sizePx: number; opacityMul: number }[]} */
  const instances = [];

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} sizePx
   */
  function collides(x, y, sizePx) {
    for (const inst of instances) {
      const distPx = Math.hypot((x - inst.x) * SCATTER_BOX_PX, (y - inst.y) * SCATTER_BOX_PX);
      const minDist = (sizePx + inst.sizePx) * spacingK;
      if (distPx < minDist) return true;
    }
    return false;
  }

  /** @type {{ x: number; y: number; row: number; col: number; score: number }[]} */
  const slots = [];
  const yRows = reducedMotion
    ? [-0.02, 0.25, 0.52, 0.79, 1.06]
    : [-0.04, 0.15, 0.34, 0.53, 0.72, 0.91, 1.1];
  const evenXs = isCard ? [0.15, 0.5, 0.85] : [0.14, 0.5, 0.86];
  const oddXs = isCard ? [-0.02, 0.32, 0.66, 1] : [-0.04, 0.31, 0.66, 1.04];

  for (let row = 0; row < yRows.length; row++) {
    const xs = row % 2 === 0 ? evenXs : oddXs;
    for (let col = 0; col < xs.length; col++) {
      const jitterX = (seeded01(seedN, row * 31 + col, 301) - 0.5) * 0.012;
      const jitterY = (seeded01(seedN, row * 31 + col, 302) - 0.5) * 0.012;
      const x = xs[col] + jitterX;
      const y = yRows[row] + jitterY;
      const d = Math.hypot(x - 0.5, y - 0.5);
      if (x < -0.08 || x > 1.08 || y < -0.08 || y > 1.12) continue;
      if (d < exclusion) continue;
      slots.push({
        x,
        y,
        row,
        col,
        score: row * 10 + col,
      });
    }
  }

  slots.sort((a, b) => a.score - b.score);

  for (let i = 0; i < count; i++) {
    const scale = 0.78 + seeded01(seedN, i, 20) * 0.28;
    const basePx = 22 + (hashPresentationSeed(`${layoutSeedStr}:bz${i}`) % 21);
    const sizePx = basePx * scale;
    const opacityMul = 0.36 + seeded01(seedN, i, 21) * 0.5;

    let best = null;
    for (let attempt = 0; attempt < slots.length; attempt++) {
      const slot = slots[(i + attempt) % slots.length];
      if (!slot) break;
      if (instances.some((inst) => inst.slotRow === slot.row && inst.slotCol === slot.col)) continue;
      if (collides(slot.x, slot.y, sizePx)) continue;
      best = slot;
      break;
    }

    if (!best) continue;

    instances.push({
      x: best.x,
      y: best.y,
      slotRow: best.row,
      slotCol: best.col,
      xPct: best.x * 100,
      yPct: best.y * 100,
      sizePx,
      opacityMul,
    });
  }

  return { globalAngleDeg, instances };
}

/**
 * @param {string} symbolId
 */
function SymbolGlyph({ symbolId }) {
  switch (symbolId) {
    case "ladybug":
      return (
        <g>
          <ellipse cx="12" cy="13" rx="8" ry="6.5" />
          <line x1="12" y1="6" x2="12" y2="20" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="9" cy="11" r="1.4" fill="currentColor" opacity="0.45" />
          <circle cx="15" cy="11" r="1.4" fill="currentColor" opacity="0.45" />
          <circle cx="9" cy="15" r="1.2" fill="currentColor" opacity="0.45" />
          <circle cx="15" cy="15" r="1.2" fill="currentColor" opacity="0.45" />
        </g>
      );
    case "paw":
      return (
        <g>
          <ellipse cx="12" cy="15.5" rx="5.2" ry="4.2" />
          <circle cx="7.8" cy="8.2" r="2.15" />
          <circle cx="10.8" cy="6.3" r="1.95" />
          <circle cx="13.5" cy="6.3" r="1.95" />
          <circle cx="16.5" cy="8.5" r="2.15" />
        </g>
      );
    case "cross":
      return (
        <path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6V4Z" />
      );
    case "star":
      return (
        <path d="M12 3l2.35 6.5L21 10l-5.5 3.5L17.18 21 12 17.5 6.82 21 8.5 13.5 3 10l6.65-.5L12 3z" />
      );
    case "heart":
      return (
        <path d="M12 20.5S4 14.2 4 9.25A4.45 4.45 0 0 1 8.5 5c1.48 0 2.82.72 3.5 1.85A4.39 4.39 0 0 1 15.5 5 4.45 4.45 0 0 1 20 9.25C20 14.2 12 20.5 12 20.5z" />
      );
    case "crown":
      return (
        <path d="M4 17h16l-1-8-4 3-3-6-3 6-4-3-1 8zm2-2h12" stroke="currentColor" strokeWidth="1.2" fill="none" />
      );
    case "rocket":
      return (
        <path
          d="M12 3s4 3.5 4 9.5c0 2-.5 4-1 5.5l-1.5-2.5H10.5L9 18c-.5-1.5-1-3.5-1-5.5C8 6.5 12 3 12 3zm0 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"
          stroke="currentColor"
          strokeWidth="0.9"
          fill="none"
        />
      );
    case "diamond":
      return <path d="M12 4l7 8-7 8-7-8 7-8z" stroke="currentColor" strokeWidth="1.1" fill="none" />;
    case "moon":
      return (
        <path d="M18 11c-.6 3.6-3.3 6-7 6-4.1 0-7-2.9-7-7 0-3.7 2.4-6.4 6-7a7 7 0 0 0 8 8z" />
      );
    case "sun":
      return (
        <g stroke="currentColor" strokeWidth="1.1" fill="none">
          <circle cx="12" cy="12" r="3.8" fill="currentColor" />
          <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.34 6.34l1.42 1.42M16.24 16.24l1.42 1.42M6.34 17.66l1.42-1.42M16.24 7.76l1.42-1.42" />
        </g>
      );
    case "lightning":
      return <path d="M13 3L6 13h5l-2 8 9-12h-5l0-6z" />;
    case "flower":
      return (
        <g stroke="currentColor" strokeWidth="0.9" fill="none">
          <circle cx="12" cy="12" r="2.2" />
          <ellipse cx="12" cy="8" rx="2" ry="3.5" />
          <ellipse cx="12" cy="16" rx="2" ry="3.5" />
          <ellipse cx="8" cy="12" rx="3.5" ry="2" />
          <ellipse cx="16" cy="12" rx="3.5" ry="2" />
        </g>
      );
    case "skull":
      return (
        <g stroke="currentColor" strokeWidth="1" fill="none">
          <path d="M9 6h6a4 4 0 0 1 4 4v2a5 5 0 0 1-3 4v3H8v-3a5 5 0 0 1-3-4v-2a4 4 0 0 1 4-4z" />
          <circle cx="9.5" cy="12" r="1" fill="currentColor" />
          <circle cx="14.5" cy="12" r="1" fill="currentColor" />
        </g>
      );
    case "anchor":
      return (
        <g stroke="currentColor" strokeWidth="1.2" fill="none">
          <path d="M12 5v14M9 17c1.8 1.2 4.2 1.2 6 0" />
          <path d="M8 10h8" />
        </g>
      );
    case "infinity":
      return (
        <path
          d="M8 12c-2 0-3-1.2-3-3s1-3 3-3c1.2 0 2.3.6 3 1.6.7-1 1.8-1.6 3-1.6 2 0 3 1.2 3 3s-1 3-3 3c-1.2 0-2.3-.6-3-1.6-.7 1-1.8 1.6-3 1.6z"
          stroke="currentColor"
          strokeWidth="1.2"
          fill="none"
        />
      );
    case "wave":
      return (
        <path d="M3 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0" stroke="currentColor" strokeWidth="1.3" fill="none" />
      );
    case "shell":
      return (
        <path
          d="M7 16c1-5 3.5-9 5-9s4 4 5 9c-2 1.5-8 1.5-10 0z"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
        />
      );
    case "clover":
      return (
        <g fill="currentColor">
          <circle cx="12" cy="9" r="3" />
          <circle cx="9" cy="13" r="3" />
          <circle cx="15" cy="13" r="3" />
          <circle cx="12" cy="17" r="2.2" />
        </g>
      );
    case "butterfly":
      return (
        <path
          d="M12 6c-2-2-5-2-5 1s2 3 5 2m0-3c2-2 5-2 5 1s-2 3-5 2m0 3v6"
          stroke="currentColor"
          strokeWidth="1.1"
          fill="none"
        />
      );
    case "leaf":
      return (
        <path d="M12 20S6 14 6 9a6 6 0 0 1 11-3c1 3 0 6-5 8l-2 1 2-5" stroke="currentColor" strokeWidth="1.1" fill="none" />
      );
    case "flame":
      return <path d="M12 20c-3-2-4-5-2-8 0-3 2-6 2-8 0 4 4 6 3 9 1-1 2 0 2 2 0 3-2 5-5 5z" />;
    case "snowflake":
      return (
        <g stroke="currentColor" strokeWidth="0.95">
          <path d="M12 4v16M6 7l12 10M18 7L6 17" />
        </g>
      );
    case "note":
      return (
        <g stroke="currentColor" strokeWidth="1.1" fill="none">
          <path d="M9 18V8l8-2v10" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="15" cy="16" r="2" />
        </g>
      );
    case "peace":
      return (
        <g stroke="currentColor" strokeWidth="1.2" fill="none">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4v16M12 12l-5 6M12 12l5 6" />
        </g>
      );
    case "eye":
      return (
        <g stroke="currentColor" strokeWidth="1.1" fill="none">
          <ellipse cx="12" cy="12" rx="8" ry="5" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" />
        </g>
      );
    case "key":
      return (
        <g stroke="currentColor" strokeWidth="1.1" fill="none">
          <circle cx="8" cy="8" r="3" />
          <path d="M10.5 10.5L18 18l-2 2-2.5-2.5M14 16l2 2" />
        </g>
      );
    case "lock":
      return (
        <g stroke="currentColor" strokeWidth="1.1" fill="none">
          <rect x="7" y="11" width="10" height="10" rx="1.5" />
          <path d="M9 11V8a3 3 0 0 1 6 0v3" />
        </g>
      );
    case "gift":
      return (
        <g stroke="currentColor" strokeWidth="1.1" fill="none">
          <rect x="5" y="10" width="14" height="11" rx="1" />
          <path d="M12 5v16M7 9h10" />
        </g>
      );
    case "bow":
      return (
        <path
          d="M12 20v-4M8 8c-2 0-4 1.5-4 4s2 4 4 4 4-2 4-4v-4H8zm8 0c2 0 4 1.5 4 4s-2 4-4 4-4-2-4-4v-4h4z"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
        />
      );
    default:
      return <circle cx="12" cy="12" r="3" />;
  }
}

/**
 * Organic scattered raster symbols (Gift `/symbols/*.png`) — not a CSS repeat grid.
 */
function GiftRasterPatternScatter({ url, scatterSurface, reducedMotion }) {
  const safe = typeof url === "string" ? url.trim() : "";
  const layout = useMemo(() => {
    if (!safe) return { globalAngleDeg: -22, instances: [] };
    return buildRasterScatterLayout(scatterSurface, reducedMotion);
  }, [safe, scatterSurface, reducedMotion]);

  if (!safe) return null;

  const bg = `url(${JSON.stringify(safe)})`;

  return (
    <div className="giftPatternLayer__rasterScatter" aria-hidden>
      {layout.instances.map((inst, i) => (
        <div
          key={i}
          className="giftPatternLayer__rasterTile"
          style={{
            left: `${inst.xPct}%`,
            top: `${inst.yPct}%`,
            width: `${inst.sizePx}px`,
            height: `${inst.sizePx}px`,
            opacity: inst.opacityMul,
            transform: `translate(-50%, -50%) rotate(${layout.globalAngleDeg}deg)`,
            backgroundImage: bg,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Scattered low-contrast symbol tiles (Fragment-style atmosphere).
 * @param {{ symbolId: string; symbolRasterUrl?: string; color: string; seed: string; reducedMotion: boolean; tileCount?: number; scatterSurface?: ScatterSurface }} props
 */
function GiftPatternLayerInner({
  symbolId,
  symbolRasterUrl,
  color,
  seed,
  reducedMotion,
  tileCount = 32,
  scatterSurface = "detail",
}) {
  const raster = typeof symbolRasterUrl === "string" ? symbolRasterUrl.trim() : "";
  const clipUid = useId().replace(/:/g, "");
  const clipId = `giftPatClip-${clipUid}`;

  const globalGlyphAngleDeg = useMemo(
    () => -20 - (hashPresentationSeed(String(seed ?? "0") + "glyphAngle") % 9),
    [seed],
  );

  const tiles = useMemo(() => {
    if (raster || !symbolId) return [];
    const seedN = hashPresentationSeed(seed);
    const n = reducedMotion ? Math.min(tileCount, 14) : tileCount;
    const out = [];
    for (let i = 0; i < n; i++) {
      const x = seeded01(seedN, i, 1) * 88 + 6;
      const y = seeded01(seedN, i, 2) * 88 + 6;
      const s = 0.75 + seeded01(seedN, i, 4) * 0.55;
      const o = 0.28 + seeded01(seedN, i, 5) * 0.42;
      out.push({ x, y, s, o });
    }
    return out;
  }, [seed, reducedMotion, tileCount, raster, symbolId]);

  if (raster) {
    return (
      <GiftRasterPatternScatter
        url={raster}
        seed={seed}
        scatterSurface={scatterSurface}
        reducedMotion={reducedMotion}
      />
    );
  }

  if (!symbolId) return null;

  return (
    <svg
      className="giftPatternLayer__svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width="100" height="100" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`} fill="currentColor" style={{ color }}>
        {tiles.map((t, i) => (
          <g
            key={i}
            transform={`translate(${t.x} ${t.y}) rotate(${globalGlyphAngleDeg}) scale(${t.s})`}
            opacity={t.o}
          >
            <g transform="translate(-12 -12)" fill="currentColor">
              <SymbolGlyph symbolId={symbolId} />
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}

export const GiftPatternLayer = memo(GiftPatternLayerInner);

export const GIFT_PATTERN_SYMBOL_IDS = new Set([
  "ladybug",
  "paw",
  "cross",
  "star",
  "heart",
  "crown",
  "rocket",
  "diamond",
  "moon",
  "sun",
  "lightning",
  "flower",
  "skull",
  "anchor",
  "infinity",
  "wave",
  "shell",
  "clover",
  "butterfly",
  "leaf",
  "flame",
  "snowflake",
  "note",
  "peace",
  "eye",
  "key",
  "lock",
  "gift",
  "bow",
]);
