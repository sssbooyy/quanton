import { useCallback, useEffect, useRef, useState } from "react";
import { sapphireDisplay, sapphireNumber } from "../../lib/sapphireFormat.js";

const AMBIENT_PARTICLES = [
  { id: "a1", left: "18%", delay: "0s", size: 3 },
  { id: "a2", left: "72%", delay: "1.2s", size: 2 },
  { id: "a3", left: "44%", delay: "2.4s", size: 2 },
  { id: "a4", left: "58%", delay: "0.8s", size: 3 },
  { id: "a5", left: "32%", delay: "3.1s", size: 2 },
  { id: "a6", left: "82%", delay: "1.8s", size: 2 },
  { id: "a7", left: "26%", delay: "2.2s", size: 2 },
  { id: "a8", left: "64%", delay: "3.6s", size: 3 },
];

function CrystalSvg() {
  return (
    <svg
      className="sapphire-reactor__crystalSvg"
      viewBox="0 0 120 168"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sapphireCrystalBody" x1="60" y1="8" x2="60" y2="160" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#76C7FF" stopOpacity="0.95" />
          <stop offset="35%" stopColor="#4AB8FF" stopOpacity="0.85" />
          <stop offset="70%" stopColor="#1E88FF" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#0B3D7A" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="sapphireCrystalFacetL" x1="12" y1="48" x2="60" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A8DCFF" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#1E88FF" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id="sapphireCrystalFacetR" x1="108" y1="48" x2="60" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4AB8FF" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#0A2A52" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="sapphireCrystalCore" x1="60" y1="40" x2="60" y2="130" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
          <stop offset="45%" stopColor="#76C7FF" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#1E88FF" stopOpacity="0" />
        </linearGradient>
        <filter id="sapphireCrystalBlur" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path
        d="M60 6 L108 46 L90 158 L30 158 L12 46 Z"
        fill="url(#sapphireCrystalBody)"
        stroke="rgba(118,199,255,0.45)"
        strokeWidth="0.75"
      />
      <path d="M60 6 L12 46 L30 158 L60 120 Z" fill="url(#sapphireCrystalFacetL)" opacity="0.85" />
      <path d="M60 6 L108 46 L90 158 L60 120 Z" fill="url(#sapphireCrystalFacetR)" opacity="0.75" />
      <path
        d="M60 28 L78 52 L68 118 L52 118 L42 52 Z"
        fill="url(#sapphireCrystalCore)"
        opacity="0.7"
      />
      <path d="M60 6 L60 120" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
      <path d="M12 46 L90 158" stroke="rgba(118,199,255,0.12)" strokeWidth="0.5" />
      <path d="M108 46 L30 158" stroke="rgba(118,199,255,0.12)" strokeWidth="0.5" />
      <ellipse cx="60" cy="42" rx="14" ry="6" fill="rgba(255,255,255,0.22)" filter="url(#sapphireCrystalBlur)" />
    </svg>
  );
}

export default function MiningReactor({
  profile,
  tapping,
  floats = [],
  onTap,
}) {
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
    const particles = Array.from({ length: 7 }, (_, i) => ({
      id: `${burstId}-${i}`,
      left: 28 + ((i * 13) % 44),
      delay: `${i * 40}ms`,
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
    <section className="sapphire-reactor sapphire-glass sapphire-glow--strong" aria-label="Mining reactor">
      <div className="sapphire-reactor__head">
        <span className="sapphire-label">Total Shards</span>
        <span className="sapphire-reactor__shards sapphire-mono" key={profile?.shards}>
          {sapphireNumber(profile?.shards)}
        </span>
      </div>

      <div
        className={`sapphire-reactor__stage ${active ? "sapphire-reactor__stage--active" : ""} ${disabled ? "sapphire-reactor__stage--disabled" : ""}`}
      >
        <div className="sapphire-reactor__beam" aria-hidden="true" />

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
            <div className="sapphire-reactor__crystalHalo" aria-hidden="true" />
            <CrystalSvg />

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

      <p className="sapphire-reactor__rate sapphire-mono">
        {disabled
          ? "Recharging energy…"
          : sapphireDisplay(perTapText)}
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
        {/* TODO: boost timer */}
        <div className="sapphire-reactor__status">
          <span className="sapphire-reactor__statusLabel">Boost</span>
          <span className="sapphire-reactor__statusValue sapphire-mono">—</span>
        </div>
        {/* TODO: auto mine mode */}
        <div className="sapphire-reactor__status">
          <span className="sapphire-reactor__statusLabel">Auto Mine</span>
          <span className="sapphire-reactor__statusValue sapphire-mono">—</span>
        </div>
      </div>

      {/* TODO: sound effects */}
      {/* TODO: WebGL crystal */}
    </section>
  );
}
