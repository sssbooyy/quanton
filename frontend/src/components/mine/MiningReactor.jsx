import { useCallback, useEffect, useRef, useState } from "react";
import { sapphireDisplay, sapphireNumber } from "../../lib/sapphireFormat.js";
import crystalImg from "../../assets/sapphire-crystal.png";

const FLOATING_SHARDS = [
  { id: "s1", left: "6%", top: "18%", delay: "0s", size: 12, rotate: -18, dur: "7s" },
  { id: "s2", left: "88%", top: "24%", delay: "1.4s", size: 10, rotate: 22, dur: "8.5s" },
  { id: "s3", left: "14%", top: "42%", delay: "2.2s", size: 8, rotate: -8, dur: "6.5s" },
  { id: "s4", left: "82%", top: "38%", delay: "0.8s", size: 11, rotate: 14, dur: "9s" },
  { id: "s5", left: "22%", top: "62%", delay: "3.1s", size: 9, rotate: -24, dur: "7.8s" },
  { id: "s6", left: "76%", top: "58%", delay: "1.9s", size: 10, rotate: 10, dur: "8.2s" },
  { id: "s7", left: "4%", top: "72%", delay: "2.6s", size: 7, rotate: 16, dur: "6.8s" },
  { id: "s8", left: "92%", top: "68%", delay: "0.5s", size: 9, rotate: -12, dur: "7.4s" },
  { id: "s9", left: "32%", top: "12%", delay: "3.8s", size: 8, rotate: 6, dur: "9.5s" },
  { id: "s10", left: "68%", top: "14%", delay: "2.4s", size: 7, rotate: -20, dur: "8.8s" },
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
      <div
        className={`sapphire-reactor__stage ${active ? "sapphire-reactor__stage--active" : ""} ${disabled ? "sapphire-reactor__stage--disabled" : ""}`}
      >
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
          <div className="sapphire-reactor__crystalStack">
            <div className="sapphire-reactor__crystalRings" aria-hidden="true">
              <span className="sapphire-reactor__ring sapphire-reactor__ring--1" />
              <span className="sapphire-reactor__ring sapphire-reactor__ring--2" />
              <span className="sapphire-reactor__ring sapphire-reactor__ring--3" />
            </div>

            <div className="sapphire-reactor__shardField" aria-hidden="true">
              {FLOATING_SHARDS.map((s) => (
                <span
                  key={s.id}
                  className="sapphire-reactor__shard"
                  style={{
                    left: s.left,
                    top: s.top,
                    width: s.size,
                    height: s.size,
                    animationDelay: s.delay,
                    animationDuration: s.dur,
                    "--shard-rotate": `${s.rotate}deg`,
                  }}
                />
              ))}
            </div>

            <div className={`sapphire-reactor__crystalLive ${active ? "sapphire-reactor__crystalLive--tap" : ""}`}>
              <img
                className="sapphire-reactor__crystalImg"
                src={crystalImg}
                alt=""
                draggable={false}
              />
              <div className="sapphire-reactor__shineSweep" aria-hidden="true" />
            </div>

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
    </section>
  );
}
