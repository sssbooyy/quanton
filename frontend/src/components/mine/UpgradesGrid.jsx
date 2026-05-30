import { useMemo } from "react";
import UpgradeCard from "./UpgradeCard.jsx";

const UPGRADE_ORDER = ["multi_tap", "turbo_miner", "bigger_battery", "faster_recharge"];

function sortUpgrades(upgrades = []) {
  return [...upgrades].sort(
    (a, b) => UPGRADE_ORDER.indexOf(a.id) - UPGRADE_ORDER.indexOf(b.id)
  );
}

export default function UpgradesGrid({ upgrades = [], onBuy, purchasing, flashSuccess }) {
  const sorted = useMemo(() => sortUpgrades(upgrades), [upgrades]);

  return (
    <section className="sapphire-upgrades" aria-label="Upgrades">
      <h2 className="sapphire-sectionTitle">Upgrades</h2>
      <div className="sapphire-upgrades__grid">
        {sorted.length > 0 ? (
          sorted.map((upgrade) => (
            <UpgradeCard
              key={upgrade.id}
              upgrade={upgrade}
              onBuy={onBuy}
              purchasing={purchasing}
              flashSuccess={flashSuccess}
            />
          ))
        ) : (
          UPGRADE_ORDER.map((id) => (
            <article key={id} className="sapphire-upgrade sapphire-glass sapphire-skeleton" style={{ minHeight: 140 }} aria-hidden="true" />
          ))
        )}
      </div>
    </section>
  );
}
