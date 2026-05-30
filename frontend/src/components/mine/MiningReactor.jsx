import { useCallback, useEffect, useRef, useState } from "react";
import { sapphireDisplay, sapphireNumber } from "../../lib/sapphireFormat.js";
import SapphireCrystalGem from "./SapphireCrystalGem.jsx";

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
            <div className="sapphire-reactor__crystalAura sapphire-reactor__crystalAura--far" aria-hidden="true" />
            <div className="sapphire-reactor__crystalAura sapphire-reactor__crystalAura--mid" aria-hidden="true" />
            <div className="sapphire-reactor__crystalAura sapphire-reactor__crystalAura--near" aria-hidden="true" />
            <div className="sapphire-reactor__crystalAura sapphire-reactor__crystalAura--inner" aria-hidden="true" />
            <div className="sapphire-reactor__crystalHalo" aria-hidden="true" />
            <SapphireCrystalGem />

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
