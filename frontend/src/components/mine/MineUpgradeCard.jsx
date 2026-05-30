import { motion } from "framer-motion";

const UPGRADE_LABELS = {
  multi_tap: "MT",
  turbo_miner: "TM",
  bigger_battery: "BB",
  faster_recharge: "FR",
};

export default function MineUpgradeCard({ upgrade, onBuy, purchasing, flashSuccess }) {
  const lvl = upgrade?.level ?? 0;
  const max = upgrade?.maxLevel ?? 50;
  const cost = upgrade?.nextCost;
  const canAfford = upgrade?.canAfford && !upgrade?.isMaxed;
  const isMaxed = upgrade?.isMaxed;
  const busy = purchasing === upgrade?.id;
  const showGlow = canAfford && !busy;
  const justBought = flashSuccess && flashSuccess.upgradeId === upgrade?.id;
  const abbr = UPGRADE_LABELS[upgrade?.id] || "UP";

  return (
    <motion.article
      className={`mineUpg glass ${showGlow ? "mineUpg--affordable" : ""} ${justBought ? "mineUpg--success" : ""}`}
      layout
      whileHover={{ y: -2 }}
      animate={justBought ? { scale: [1, 1.02, 1] } : { scale: 1 }}
    >
      <div className="mineUpg__icon mono" aria-hidden="true">
        {abbr}
      </div>
      <div className="mineUpg__body">
        <div className="mineUpg__head">
          <h3>{upgrade?.name || upgrade?.id}</h3>
          <span className="mineUpg__lvl mono">
            Lv {lvl}/{max}
          </span>
        </div>
        <p className="mineUpg__desc">{upgrade?.description || ""}</p>
        {upgrade?.id === "multi_tap" && upgrade.maxTapBatch != null ? (
          <p className="mineUpg__live mono">
            Batch {upgrade.maxTapBatch} · {upgrade.maxTapsPerSecond}/s
          </p>
        ) : null}
        {upgrade?.nextEffect ? <p className="mineUpg__next mono">{upgrade.nextEffect}</p> : null}
        <div className="mineUpg__foot">
          {isMaxed ? (
            <span className="mineUpg__maxed mono">MAXED</span>
          ) : (
            <span className="mineUpg__cost mono">{cost?.toLocaleString()} shards</span>
          )}
          <button
            type="button"
            className={`mineUpg__btn ${canAfford ? "mineUpg__btn--buy" : ""}`}
            disabled={isMaxed || !canAfford || busy}
            onClick={() => onBuy(upgrade.id)}
          >
            {busy ? "…" : isMaxed ? "Max" : canAfford ? "Upgrade" : "Need shards"}
          </button>
        </div>
      </div>
    </motion.article>
  );
}
