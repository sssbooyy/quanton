import { motion, AnimatePresence } from "framer-motion";
import { useMining } from "../hooks/useMining.js";
import { hapticImpact } from "../lib/telegramUser.js";

function StatCard({ label, value, accent }) {
  return (
    <div className={`mineStat ${accent ? "mineStat--accent" : ""}`}>
      <span className="mineStat__label">{label}</span>
      <motion.span
        key={String(value)}
        className="mineStat__value mono"
        initial={{ scale: 1.12, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
      >
        {value}
      </motion.span>
    </div>
  );
}

function UpgradeCard({ upgrade, shards, onBuy, purchasing, flashSuccess }) {
  const lvl = upgrade?.level ?? 0;
  const max = upgrade?.maxLevel ?? 50;
  const cost = upgrade?.nextCost;
  const canAfford = upgrade?.canAfford && !upgrade?.isMaxed;
  const isMaxed = upgrade?.isMaxed;
  const busy = purchasing === upgrade?.id;
  const showGlow = canAfford && !busy;
  const justBought = flashSuccess && flashSuccess.upgradeId === upgrade?.id;

  return (
    <motion.div
      className={`mineUpgradeCard ${showGlow ? "mineUpgradeCard--affordable" : ""} ${justBought ? "mineUpgradeCard--success" : ""}`}
      layout
      animate={
        justBought
          ? { scale: [1, 1.03, 1], boxShadow: "0 0 28px rgba(56, 189, 248, 0.45)" }
          : { scale: 1 }
      }
      transition={{ duration: 0.45 }}
    >
      <div className="mineUpgradeCard__head">
        <strong>{upgrade?.name || upgrade?.id}</strong>
        <span className="mono mineUpgradeCard__lvl">
          Lv {lvl}/{max}
        </span>
      </div>
      <p className="mineUpgradeCard__desc">{upgrade?.description || ""}</p>
      {upgrade?.nextEffect ? (
        <p className="mineUpgradeCard__next mono">{upgrade.nextEffect}</p>
      ) : null}
      <div className="mineUpgradeCard__footer">
        {isMaxed ? (
          <span className="mineUpgradeCard__maxed mono">MAXED</span>
        ) : (
          <span className="mineUpgradeCard__cost mono">
            {cost?.toLocaleString()} shards
            {shards < cost ? (
              <span className="mineUpgradeCard__need"> · need {(cost - shards).toLocaleString()} more</span>
            ) : null}
          </span>
        )}
        <button
          type="button"
          className={`mineUpgradeCard__btn ${canAfford ? "mineUpgradeCard__btn--buy" : ""}`}
          disabled={isMaxed || !canAfford || busy}
          onClick={() => onBuy(upgrade.id)}
        >
          {busy ? "Upgrading…" : isMaxed ? "Max level" : canAfford ? "Upgrade" : "Not enough shards"}
        </button>
      </div>
    </motion.div>
  );
}

function MineSkeleton() {
  return (
    <div className="minePage minePage--loading" aria-busy="true">
      <div className="mineSkeleton mineSkeleton--hero" />
      <div className="mineSkeletonRow">
        <div className="mineSkeleton mineSkeleton--stat" />
        <div className="mineSkeleton mineSkeleton--stat" />
        <div className="mineSkeleton mineSkeleton--stat" />
        <div className="mineSkeleton mineSkeleton--stat" />
      </div>
      <div className="mineSkeleton mineSkeleton--bar" />
      <div className="mineSkeleton mineSkeleton--card" />
    </div>
  );
}

export default function Mine() {
  const {
    profile,
    loading,
    error,
    tapping,
    floats,
    energyPct,
    refresh,
    tap,
    claimDaily,
    purchaseUpgrade,
    upgradingId,
    upgradeFlash,
    setError,
  } = useMining();

  if (loading && !profile) {
    return <MineSkeleton />;
  }

  const xpMax = profile?.xpToNextLevel > 0 ? profile.xp + profile.xpToNextLevel : profile?.xp || 1;
  const xpPct = profile ? Math.min(100, (profile.xp / xpMax) * 100) : 0;
  const regenSec = profile?.regenSeconds ?? (profile?.energyRegenIntervalMs ?? 5000) / 1000;

  async function handleMineTap() {
    hapticImpact("medium");
    await tap();
  }

  async function handleDaily() {
    hapticImpact("light");
    await claimDaily();
  }

  async function handleUpgrade(upgradeId) {
    hapticImpact("light");
    await purchaseUpgrade(upgradeId);
  }

  return (
    <main className="minePage">
      <header className="mineHeader">
        <div>
          <p className="mineHeader__kicker mono">QUANTON MINING</p>
          <h1 className="mineHeader__title">Shard Mine</h1>
        </div>
        <button type="button" className="mineHeader__refresh mono" onClick={() => refresh()}>
          Sync
        </button>
      </header>

      {error ? (
        <p className="mineError mono" role="alert">
          {error}
          <button type="button" className="mineError__dismiss" onClick={() => setError("")}>
            ×
          </button>
        </p>
      ) : null}

      <section className="mineStatsGrid" aria-label="Mining stats">
        <StatCard label="Shards" value={profile?.shards ?? 0} accent />
        <StatCard label="Per tap" value={profile?.shardsPerTap ?? 1} />
        <StatCard label="Level" value={profile?.level ?? 1} />
        <StatCard label="Regen" value={`${regenSec}s`} />
      </section>

      <section className="mineEnergy" aria-label="Energy">
        <div className="mineEnergy__labels">
          <span>Energy</span>
          <span className="mono">
            {profile?.energy ?? 0} / {profile?.maxEnergy ?? 0}
          </span>
        </div>
        <div className="mineEnergy__track">
          <motion.div
            className="mineEnergy__fill"
            initial={false}
            animate={{ width: `${energyPct}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
        <p className="mineEnergy__hint mono">+1 energy every {regenSec}s (server)</p>
        <div className="mineXpTrack">
          <div className="mineXpTrack__fill" style={{ width: `${xpPct}%` }} />
        </div>
        <p className="mineEnergy__hint mono">
          {profile?.xpToNextLevel > 0 ? `${profile.xpToNextLevel} XP to next level` : "Max level for now"}
        </p>
      </section>

      <section className="mineTapZone">
        <div className="mineTapGlow" aria-hidden="true" />
        <motion.button
          type="button"
          className="mineTapBtn"
          disabled={tapping || (profile?.energy ?? 0) <= 0}
          whileTap={{ scale: 0.94 }}
          animate={
            tapping
              ? { boxShadow: "0 0 48px rgba(56, 189, 248, 0.55)" }
              : { boxShadow: "0 0 32px rgba(99, 102, 241, 0.35)" }
          }
          onClick={handleMineTap}
        >
          <span className="mineTapBtn__ring" aria-hidden="true" />
          <span className="mineTapBtn__label">Mine Shards</span>
          <span className="mineTapBtn__sub mono">
            {(profile?.energy ?? 0) <= 0 ? "Recharging…" : `+${profile?.shardsPerTap ?? 1} shard / tap`}
          </span>
        </motion.button>
        <AnimatePresence>
          {floats.map((f, i) => (
            <motion.span
              key={f.id}
              className={`mineFloat mono ${f.amount < 0 ? "mineFloat--cost" : ""}`}
              initial={{ opacity: 0, y: 0, scale: 0.6 }}
              animate={{ opacity: 1, y: -72 - i * 8, scale: 1 }}
              exit={{ opacity: 0, y: -100 }}
              transition={{ duration: 0.75, ease: "easeOut" }}
            >
              {f.amount > 0 ? `+${f.amount}` : f.amount}
            </motion.span>
          ))}
        </AnimatePresence>
      </section>

      <section className="mineDailyCard">
        <div className="mineDailyCard__copy">
          <h2>Daily reward</h2>
          <p className="mono">
            Streak: {profile?.dailyStreak ?? 0} day{(profile?.dailyStreak ?? 0) === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          className="mineDailyCard__btn"
          disabled={!profile?.canClaimDaily}
          onClick={handleDaily}
        >
          {profile?.canClaimDaily ? "Claim" : "Claimed"}
        </button>
      </section>

      <section className="mineUpgrades">
        <h2 className="mineUpgrades__title">Upgrades</h2>
        <div className="mineUpgrades__grid">
          {(profile?.upgrades || []).map((u) => (
            <UpgradeCard
              key={u.id}
              upgrade={u}
              shards={profile?.shards ?? 0}
              onBuy={handleUpgrade}
              purchasing={upgradingId}
              flashSuccess={upgradeFlash}
            />
          ))}
        </div>
      </section>

      <p className="mineFooterNote mono">
        Shards are off-chain. Utility (listings, discounts, crates) ships later.
      </p>
    </main>
  );
}
