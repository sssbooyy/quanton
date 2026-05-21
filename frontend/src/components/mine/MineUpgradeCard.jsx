import { motion } from "framer-motion";
import MineIcon from "./MineIcon.jsx";
import { mineIcons, upgradeToIcon } from "../../lib/mineIcons.js";

export default function MineUpgradeCard({ upgrade, shards, onBuy, purchasing, flashSuccess }) {
  const lvl = upgrade?.level ?? 0;
  const max = upgrade?.maxLevel ?? 50;
  const cost = upgrade?.nextCost;
  const canAfford = upgrade?.canAfford && !upgrade?.isMaxed;
  const isMaxed = upgrade?.isMaxed;
  const busy = purchasing === upgrade?.id;
  const showGlow = canAfford && !busy;
  const justBought = flashSuccess && flashSuccess.upgradeId === upgrade?.id;
  const iconSrc = upgradeToIcon(upgrade?.id);
  const iconGlow =
    upgrade?.id === "bigger_battery"
      ? "green"
      : upgrade?.id === "faster_recharge"
        ? "gold"
        : "purple";

  return (
    <motion.article
      className={`mineUpg ${showGlow ? "mineUpg--affordable" : ""} ${justBought ? "mineUpg--success" : ""}`}
      layout
      whileHover={{ y: -2 }}
      animate={justBought ? { scale: [1, 1.02, 1] } : { scale: 1 }}
    >
      <div className="mineUpg__icon" aria-hidden="true">
        <MineIcon src={iconSrc} size={64} glow={iconGlow} pulse={showGlow} />
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
            <span className="mineUpg__cost mono">
              {cost?.toLocaleString()}{" "}
              <MineIcon src={mineIcons.shards} size={14} glow="purple" />
            </span>
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
