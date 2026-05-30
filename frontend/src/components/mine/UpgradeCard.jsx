import { sapphireDisplay, sapphireNumber } from "../../lib/sapphireFormat.js";

export default function UpgradeCard({ upgrade, onBuy, purchasing, flashSuccess }) {
  const lvl = upgrade?.level;
  const max = upgrade?.maxLevel;
  const cost = upgrade?.nextCost;
  const canAfford = upgrade?.canAfford && !upgrade?.isMaxed;
  const isMaxed = upgrade?.isMaxed;
  const busy = purchasing === upgrade?.id;
  const justBought = flashSuccess?.upgradeId === upgrade?.id;

  const currentEffect =
    upgrade?.currentEffect ?? upgrade?.description ?? null;
  const nextEffect = upgrade?.nextEffect ?? null;

  return (
    <article
      className={`sapphire-upgrade sapphire-glass ${canAfford ? "sapphire-upgrade--affordable" : ""} ${justBought ? "sapphire-upgrade--success" : ""}`}
    >
      <div className="sapphire-upgrade__head">
        <h3 className="sapphire-upgrade__title">{upgrade?.name || upgrade?.id || "—"}</h3>
        <span className="sapphire-upgrade__level sapphire-mono">
          {lvl != null && max != null ? `Lv ${lvl}/${max}` : "—"}
        </span>
      </div>

      <div className="sapphire-upgrade__row">
        <span className="sapphire-upgrade__rowLabel">Current effect</span>
        <span>{sapphireDisplay(currentEffect)}</span>
      </div>

      <div className="sapphire-upgrade__row">
        <span className="sapphire-upgrade__rowLabel">Next effect</span>
        <span>{isMaxed ? "Maxed" : sapphireDisplay(nextEffect)}</span>
      </div>

      <div className="sapphire-upgrade__foot">
        <span className="sapphire-upgrade__cost sapphire-mono">
          {isMaxed ? "MAXED" : cost != null ? `${sapphireNumber(cost)} shards` : "—"}
        </span>
        <button
          type="button"
          className={`sapphire-upgrade__btn ${canAfford ? "sapphire-upgrade__btn--buy" : ""}`}
          disabled={isMaxed || !canAfford || busy}
          onClick={() => onBuy?.(upgrade?.id)}
        >
          {busy ? "…" : isMaxed ? "Max" : canAfford ? "Upgrade" : "Need shards"}
        </button>
      </div>
    </article>
  );
}
