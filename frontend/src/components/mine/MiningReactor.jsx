import { useId } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { sapphireDisplay, sapphireNumber } from "../../lib/sapphireFormat.js";

const AMBIENT_PARTICLES = [
  { id: "a1", left: "12%", delay: "0s", size: 3 },
  { id: "a2", left: "78%", delay: "1.1s", size: 2 },
  { id: "a3", left: "38%", delay: "2.3s", size: 2 },
  { id: "a4", left: "62%", delay: "0.6s", size: 3 },
  { id: "a5", left: "24%", delay: "3.2s", size: 2 },
  { id: "a6", left: "88%", delay: "1.7s", size: 2 },
  { id: "a7", left: "48%", delay: "2.8s", size: 2 },
  { id: "a8", left: "68%", delay: "3.9s", size: 3 },
  { id: "a9", left: "18%", delay: "4.4s", size: 2 },
  { id: "a10", left: "54%", delay: "1.4s", size: 2 },
];

function CrystalSvg({ uid }) {
  const body = `scBody-${uid}`;
  const facetL = `scFacetL-${uid}`;
  const facetR = `scFacetR-${uid}`;
  const core = `scCore-${uid}`;
  const innerGlow = `scInnerGlow-${uid}`;
  const refract = `scRefract-${uid}`;
  const reflect = `scReflect-${uid}`;
  const glow = `scGlow-${uid}`;

  return (
    <svg
      className="sapphire-reactor__crystalSvg"
      viewBox="0 0 120 168"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={body} x1="60" y1="4" x2="60" y2="162" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8FD4FF" stopOpacity="0.98" />
          <stop offset="28%" stopColor="#4AB8FF" stopOpacity="0.9" />
          <stop offset="62%" stopColor="#1E88FF" stopOpacity="0.82" />
          <stop offset="100%" stopColor="#062849" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id={facetL} x1="8" y1="44" x2="58" y2="128" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#D6EEFF" stopOpacity="0.62" />
          <stop offset="100%" stopColor="#1E88FF" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id={facetR} x1="112" y1="44" x2="62" y2="128" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3AA0FF" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#041830" stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id={innerGlow} cx="50%" cy="38%" r="48%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.75" />
          <stop offset="35%" stopColor="#76C7FF" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#1E88FF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={core} x1="60" y1="52" x2="60" y2="112" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="40%" stopColor="#76C7FF" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#1E88FF" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id={refract} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="42%" stopColor="#A8DCFF" stopOpacity="0.35" />
          <stop offset="58%" stopColor="#4AB8FF" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={reflect} x1="20" y1="10" x2="90" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse cx="60" cy="118" rx="38" ry="10" fill="rgba(30,136,255,0.22)" filter={`url(#${glow})`} />

      <path
        d="M60 4 L110 44 L92 162 L28 162 L10 44 Z"
        fill={`url(#${body})`}
        stroke="rgba(118,199,255,0.5)"
        strokeWidth="0.6"
      />

      <path d="M60 4 L10 44 L28 162 L60 118 Z" fill={`url(#${facetL})`} opacity="0.88" />
      <path d="M60 4 L110 44 L92 162 L60 118 Z" fill={`url(#${facetR})`} opacity="0.78" />

      <path
        d="M60 4 L110 44 L92 162 L28 162 L10 44 Z"
        fill={`url(#${innerGlow})`}
        opacity="0.55"
        className="sapphire-reactor__innerGlow"
      />

      <path
        d="M60 22 L84 48 L74 124 L46 124 L36 48 Z"
        fill={`url(#${refract})`}
        opacity="0.65"
        className="sapphire-reactor__refractionLayer"
      />

      <path d="M22 52 L48 18" stroke={`url(#${reflect})`} strokeWidth="2.5" strokeLinecap="round" opacity="0.45" />
      <path d="M34 38 L52 24" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M88 58 L72 78" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeLinecap="round" />

      <path
        d="M60 48 L72 62 L66 108 L54 108 L48 62 Z"
        fill={`url(#${core})`}
        opacity="0.85"
      />

      <circle cx="60" cy="76" r="9" className="sapphire-reactor__energyCore" fill="rgba(255,255,255,0.92)" />
      <circle cx="60" cy="76" r="14" className="sapphire-reactor__energyCoreRing" fill="none" stroke="rgba(118,199,255,0.55)" strokeWidth="0.6" />

      <path d="M60 4 L60 118" stroke="rgba(255,255,255,0.2)" strokeWidth="0.45" />
      <path d="M10 44 L92 162" stroke="rgba(118,199,255,0.14)" strokeWidth="0.4" />
      <path d="M110 44 L28 162" stroke="rgba(118,199,255,0.14)" strokeWidth="0.4" />

      <ellipse cx="60" cy="38" rx="16" ry="7" fill="rgba(255,255,255,0.28)" filter={`url(#${glow})`} />
    </svg>
  );
}

export default function MiningReactor({
  profile,
  tapping,
  floats = [],
  onTap,
}) {
  const uid = useId().replace(/:/g, "");
  const energy = profile?.energy ?? 0;
  const disabled = energy <= 0;
  const [isPulsing, setIsPulsing] = useState(false);
  const [bursts, setBursts] = useState([]);
  const burstTimerRef = useRef(null);
  const pulseTimerRef = useRef(null);

  const triggerTapFx = useCallback(() => {
    setIsPulsing(true);
    window.clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = window.setTimeout(() => setIsPulsing(false), 450);

    const burstId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const particles = Array.from({ length: 9 }, (_, i) => ({
      id: `${burstId}-${i}`,
      left: 18 + ((i * 11) % 64),
      delay: `${i * 35}ms`,
    }));
    setBursts((prev) => [...prev.slice(-1), { id: burstId, particles }]);
    window.clearTimeout(burstTimerRef.current);
    burstTimerRef.current = window.setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.id !== burstId));
    }, 900);
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(burstTimerRef.current);
      window.clearTimeout(pulseTimerRef.current);
    },
    []
  );

  function handleMineTap(e) {
    e.preventDefault();
    if (disabled) return;
    triggerTapFx();
    onTap?.(1);
  }

  const perTapText =
    profile?.shardsPerTap != null && profile?.maxTapBatch != null
      ? `+${profile.shardsPerTap} / tap · ×${profile.maxTapBatch}`
      : null;

  const active = tapping || isPulsing;

  return (
    <section className="sapphire-reactor sapphire-reactor--hero" aria-label="Mining reactor">
      <div
        className={`sapphire-reactor__stage ${active ? "sapphire-reactor__stage--active" : ""} ${disabled ? "sapphire-reactor__stage--disabled" : ""}`}
      >
        <div className="sapphire-reactor__beam" aria-hidden="true" />
        <div className="sapphire-reactor__beam sapphire-reactor__beam--narrow" aria-hidden="true" />

        <div className="sapphire-reactor__rings" aria-hidden="true">
          <span className="sapphire-reactor__ring sapphire-reactor__ring--1" />
          <span className="sapphire-reactor__ring sapphire-reactor__ring--2" />
          <span className="sapphire-reactor__ring sapphire-reactor__ring--3" />
        </div>

        <div className="sapphire-reactor__ambient" aria-hidden="true">
          {AMBIENT_PARTICLES.map((p) => (
            <span
              key={p.id}
              className="sapphire-reactor__ambientParticle"
              style={{
                left: p.left,
                animationDelay: p.delay,
                width: p.size,
                height: p.size,
              }}
            />
          ))}
        </div>

        <div className="sapphire-reactor__head sapphire-reactor__head--overlay">
          <span className="sapphire-label">Total Shards</span>
          <span className="sapphire-reactor__shards sapphire-mono">{sapphireNumber(profile?.shards)}</span>
        </div>

        <button
          type="button"
          className="sapphire-reactor__crystalBtn"
          disabled={disabled}
          onPointerDown={handleMineTap}
          style={{ touchAction: "manipulation" }}
          aria-label="Tap crystal to mine shards"
        >
          <div className="sapphire-reactor__crystalWrap">
            <div className="sapphire-reactor__crystalAura" aria-hidden="true" />
            <div className="sapphire-reactor__crystalAura sapphire-reactor__crystalAura--inner" aria-hidden="true" />
            <div className="sapphire-reactor__crystalHalo" aria-hidden="true" />
            <div className="sapphire-reactor__glassSheen" aria-hidden="true" />
            <CrystalSvg uid={uid} />

            {bursts.map((burst) =>
              burst.particles.map((p) => (
                <span
                  key={p.id}
                  className="sapphire-reactor__burstParticle"
                  style={{ left: `${p.left}%`, animationDelay: p.delay }}
                />
              ))
            )}

            {floats.map((f, i) => (
              <span
                key={f.id}
                className={`sapphire-reactor__float sapphire-mono ${f.amount < 0 ? "sapphire-reactor__float--cost" : ""}`}
                style={{ "--float-index": i }}
              >
                {f.amount > 0 ? `+${f.amount}` : f.amount}
              </span>
            ))}
          </div>
        </button>
      </div>

      <div className="sapphire-reactor__controls">
        <p className="sapphire-reactor__rate sapphire-mono">
          {disabled ? "Recharging energy…" : sapphireDisplay(perTapText)}
        </p>

        <button
          type="button"
          className={`sapphire-reactor__mineBtn ${active ? "sapphire-reactor__mineBtn--active" : ""}`}
          disabled={disabled}
          onPointerDown={handleMineTap}
          style={{ touchAction: "manipulation" }}
          aria-label="Mine shards"
        >
          MINE SHARDS
        </button>

        <div className="sapphire-reactor__statusRow">
          <div className="sapphire-reactor__status">
            <span className="sapphire-reactor__statusLabel">Boost</span>
            <span className="sapphire-reactor__statusValue sapphire-mono">—</span>
          </div>
          <div className="sapphire-reactor__status">
            <span className="sapphire-reactor__statusLabel">Auto Mine</span>
            <span className="sapphire-reactor__statusValue sapphire-mono">—</span>
          </div>
        </div>
      </div>

      {/* TODO: boost timer · auto mine mode · sound effects · WebGL crystal */}
    </section>
  );
}
