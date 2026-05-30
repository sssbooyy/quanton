import { sapphireDisplay } from "../../lib/sapphireFormat.js";

export default function MiningReactor({
  profile,
  tapping,
  floats = [],
  onTap,
}) {
  const energy = profile?.energy ?? 0;
  const disabled = energy <= 0;

  return (
    <section className="sapphire-reactor sapphire-glass sapphire-glow--strong" aria-label="Mining reactor">
      <h2 className="sapphire-sectionTitle">Reactor</h2>

      <div className="sapphire-reactor__crystal">
        <div className="sapphire-reactor__crystalInner" aria-hidden="true" />
        {floats.map((f, i) => (
          <span
            key={f.id}
            className={`sapphire-reactor__float sapphire-mono ${f.amount < 0 ? "sapphire-reactor__float--cost" : ""}`}
            style={{ top: `${38 - i * 6}%` }}
          >
            {f.amount > 0 ? `+${f.amount}` : f.amount}
          </span>
        ))}
      </div>

      <button
        type="button"
        className={`sapphire-reactor__mineBtn ${tapping ? "sapphire-reactor__mineBtn--active" : ""}`}
        disabled={disabled}
        onPointerDown={(e) => {
          e.preventDefault();
          onTap?.(1);
        }}
        style={{ touchAction: "manipulation" }}
        aria-label="Mine shards"
      >
        Mine Shards
      </button>

      <p className="sapphire-reactor__hint sapphire-mono">
        {disabled
          ? "Recharging energy…"
          : sapphireDisplay(
              profile?.shardsPerTap != null && profile?.maxTapBatch != null
                ? `+${profile.shardsPerTap} / tap · ×${profile.maxTapBatch}`
                : null
            )}
      </p>

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
    </section>
  );
}
