import { useCallback, useEffect, useRef, useState } from "react";
import { sapphireDisplay, sapphireNumber } from "../../lib/sapphireFormat.js";
import SapphireCrystal3D from "./SapphireCrystal3D.jsx";

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
      left: 32 + ((i * 9 + (i % 3) * 5) % 36),
      delay: `${i * 45}ms`,
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
      <div className="sapphire-reactor__head">
        <span className="sapphire-label">Total Shards</span>
        <span className="sapphire-reactor__shards sapphire-mono">{sapphireNumber(profile?.shards)}</span>
      </div>

      <div
        className={`sapphire-reactor__stage ${active ? "sapphire-reactor__stage--active" : ""} ${disabled ? "sapphire-reactor__stage--disabled" : ""}`}
      >
        <div className="sapphire-reactor__crystalStack">
          <SapphireCrystal3D onTap={handleMineTap} disabled={disabled} pulsing={active} />

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
    </section>
  );
}
