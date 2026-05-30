import { useId } from "react";

/** Facet path + gradient direction + tone (bright | mid | dark | highlight) */
const GEM_FACETS = [
  { d: "M80 4 L14 56 L50 36 Z", tone: "dark", gx: 0, gy: 0, gx2: 1, gy2: 1 },
  { d: "M80 4 L50 36 L50 56 Z", tone: "mid", gx: 0.2, gy: 0, gx2: 0.8, gy2: 1 },
  { d: "M80 4 L80 26 L50 36 Z", tone: "highlight", gx: 0.5, gy: 0, gx2: 0, gy2: 1 },
  { d: "M80 4 L110 36 L80 26 Z", tone: "highlight", gx: 0.5, gy: 0, gx2: 1, gy2: 1 },
  { d: "M80 4 L146 56 L110 36 Z", tone: "dark", gx: 1, gy: 0, gx2: 0, gy2: 1 },
  { d: "M80 4 L110 56 L110 36 Z", tone: "mid", gx: 1, gy: 0.2, gx2: 0.2, gy2: 1 },
  { d: "M14 56 L50 56 L32 108 Z", tone: "dark", gx: 0, gy: 0.5, gx2: 1, gy2: 1 },
  { d: "M50 56 L80 56 L80 108 Z", tone: "bright", gx: 0.5, gy: 0, gx2: 0.5, gy2: 1 },
  { d: "M110 56 L146 56 L128 108 Z", tone: "dark", gx: 1, gy: 0.5, gx2: 0, gy2: 1 },
  { d: "M50 56 L80 26 L80 56 Z", tone: "bright", gx: 0.5, gy: 0, gx2: 0, gy2: 0.8 },
  { d: "M80 26 L110 56 L80 56 Z", tone: "bright", gx: 0.5, gy: 0, gx2: 1, gy2: 0.8 },
  { d: "M32 108 L50 56 L80 108 Z", tone: "mid", gx: 0, gy: 0, gx2: 1, gy2: 1 },
  { d: "M128 108 L110 56 L80 108 Z", tone: "mid", gx: 1, gy: 0, gx2: 0, gy2: 1 },
  { d: "M32 108 L44 158 L38 204 Z", tone: "dark", gx: 0, gy: 0, gx2: 0.6, gy2: 1 },
  { d: "M80 108 L44 158 L80 168 Z", tone: "mid", gx: 0.5, gy: 0, gx2: 0, gy2: 1 },
  { d: "M80 108 L116 158 L80 168 Z", tone: "mid", gx: 0.5, gy: 0, gx2: 1, gy2: 1 },
  { d: "M128 108 L116 158 L122 204 Z", tone: "dark", gx: 1, gy: 0, gx2: 0.4, gy2: 1 },
  { d: "M44 158 L38 204 L80 220 Z", tone: "dark", gx: 0, gy: 0.5, gx2: 0.5, gy2: 1 },
  { d: "M116 158 L122 204 L80 220 Z", tone: "dark", gx: 1, gy: 0.5, gx2: 0.5, gy2: 1 },
];

const TONE_STOPS = {
  highlight: [
    ["0%", "#FFFFFF", 1],
    ["35%", "#B8E8FF", 1],
    ["100%", "#4AB8FF", 0.95],
  ],
  bright: [
    ["0%", "#76C7FF", 1],
    ["45%", "#4AB8FF", 1],
    ["100%", "#1568CC", 0.98],
  ],
  mid: [
    ["0%", "#4AB8FF", 0.98],
    ["50%", "#1E88FF", 1],
    ["100%", "#0A3060", 1],
  ],
  dark: [
    ["0%", "#1E88FF", 0.92],
    ["40%", "#0C3A6E", 1],
    ["100%", "#020810", 1],
  ],
};

const SILHOUETTE = "M80 4 L146 56 L122 204 L80 220 L38 204 L14 56 Z";

export default function SapphireCrystalGem({ uid: uidProp }) {
  const reactId = useId().replace(/:/g, "");
  const uid = uidProp || reactId;
  const clipId = `gemClip-${uid}`;
  const shadowId = `gemShadow-${uid}`;
  const coreGlowId = `gemCoreGlow-${uid}`;
  const sweepId = `gemSweep-${uid}`;
  const coreRadId = `gemCoreRad-${uid}`;
  const edgeVigId = `gemEdgeVig-${uid}`;

  return (
    <svg
      className="sapphire-reactor__crystalSvg"
      viewBox="0 0 160 224"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={SILHOUETTE} />
        </clipPath>

        <filter id={shadowId} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#020810" floodOpacity="0.85" />
          <feDropShadow dx="0" dy="0" stdDeviation="14" floodColor="#1E88FF" floodOpacity="0.45" />
        </filter>

        <filter id={coreGlowId} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <linearGradient id={sweepId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#76C7FF" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>

        <radialGradient id={coreRadId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="35%" stopColor="#76C7FF" stopOpacity="1" />
          <stop offset="70%" stopColor="#4AB8FF" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#1E88FF" stopOpacity="0.4" />
        </radialGradient>

        <radialGradient id={edgeVigId} cx="50%" cy="55%" r="52%">
          <stop offset="55%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#020810" stopOpacity="0.85" />
        </radialGradient>

        {GEM_FACETS.map((f, i) => {
          const gid = `gemF${i}-${uid}`;
          const stops = TONE_STOPS[f.tone];
          const x1 = f.gx * 160;
          const y1 = f.gy * 224;
          const x2 = f.gx2 * 160;
          const y2 = f.gy2 * 224;
          return (
            <linearGradient key={gid} id={gid} x1={x1} y1={y1} x2={x2} y2={y2} gradientUnits="userSpaceOnUse">
              {stops.map(([offset, color, opacity]) => (
                <stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />
              ))}
            </linearGradient>
          );
        })}
      </defs>

      {/* Ground shadow */}
      <ellipse cx="80" cy="214" rx="46" ry="9" fill="#020810" opacity="0.65" />

      <g filter={`url(#${shadowId})`}>
        {/* Solid base — dark sapphire body */}
        <path d={SILHOUETTE} fill="#041830" />

        {/* 19 faceted surfaces */}
        {GEM_FACETS.map((f, i) => (
          <path
            key={i}
            d={f.d}
            fill={`url(#gemF${i}-${uid})`}
            stroke="rgba(2,8,16,0.35)"
            strokeWidth="0.35"
            strokeLinejoin="round"
          />
        ))}

        {/* Facet crease lines — depth */}
        <g stroke="rgba(2,8,16,0.45)" strokeWidth="0.4" fill="none" strokeLinejoin="round">
          <path d="M80 4 L80 108" opacity="0.5" />
          <path d="M14 56 L146 56" opacity="0.35" />
          <path d="M50 56 L32 108 L44 158 L38 204" opacity="0.4" />
          <path d="M110 56 L128 108 L116 158 L122 204" opacity="0.4" />
          <path d="M80 108 L80 168" opacity="0.3" />
          <path d="M38 204 L80 220 L122 204" opacity="0.45" />
        </g>

        {/* Edge vignette — dark rim */}
        <path
          d={SILHOUETTE}
          fill={`url(#${edgeVigId})`}
          opacity="0.5"
        />

        {/* Refraction specular strips */}
        <path d="M28 48 L52 22" stroke="rgba(255,255,255,0.55)" strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
        <path d="M38 40 L56 28" stroke="rgba(184,232,255,0.45)" strokeWidth="1" strokeLinecap="round" />
        <path d="M118 72 L102 92" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" strokeLinecap="round" />

        {/* Energy core */}
        <g className="sapphire-reactor__coreGroup" filter={`url(#${coreGlowId})`}>
          <circle cx="80" cy="88" r="22" fill="rgba(30,136,255,0.25)" className="sapphire-reactor__energyCoreHalo" />
          <circle cx="80" cy="88" r="14" fill={`url(#${coreRadId})`} className="sapphire-reactor__energyCore" />
          <circle cx="80" cy="88" r="6" fill="#FFFFFF" className="sapphire-reactor__energyCoreHot" />
          <circle
            cx="80"
            cy="88"
            r="18"
            fill="none"
            stroke="rgba(118,199,255,0.65)"
            strokeWidth="0.8"
            className="sapphire-reactor__energyCoreRing"
          />
        </g>

        {/* Table highlight */}
        <ellipse cx="80" cy="32" rx="18" ry="7" fill="rgba(255,255,255,0.35)" />
      </g>

      {/* Animated reflection sweep — clipped to gem */}
      <g clipPath={`url(#${clipId})`}>
        <rect
          className="sapphire-reactor__reflectionSweep"
          x="-60"
          y="0"
          width="55"
          height="224"
          fill={`url(#${sweepId})`}
          opacity="0.85"
        />
      </g>

      {/* Outer rim catch light */}
      <path
        d={SILHOUETTE}
        fill="none"
        stroke="rgba(118,199,255,0.35)"
        strokeWidth="0.6"
      />
    </svg>
  );
}
