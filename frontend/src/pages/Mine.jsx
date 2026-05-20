import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMining } from "../hooks/useMining.js";
import MineLeaderboard from "../components/MineLeaderboard.jsx";
import MineLevelCard from "../components/MineLevelCard.jsx";
import MineLevelUpModal from "../components/MineLevelUpModal.jsx";
import MineReferralCard from "../components/MineReferralCard.jsx";
import { hapticImpact } from "../lib/telegramUser.js";

const MINE_VIEWS = [
  { id: "play", label: "Mine" },
  { id: "ranks", label: "Ranks" },
  { id: "invite", label: "Invite" },
];

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
      {upgrade?.id === "multi_tap" && upgrade.maxTapBatch != null ? (
        <p className="mineUpgradeCard__stats mono">
          Batch {upgrade.maxTapBatch} · {upgrade.maxTapsPerSecond}/s
        </p>
      ) : null}
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

function MinePlayView({
  profile,
  error,
  tapping,
  floats,
  energyPct,
  upgradeFlash,
  upgradingId,
  referralClaimMsg,
  levelUp,
  dismissLevelUp,
  setError,
  refresh,
  tap,
  claimDaily,
  purchaseUpgrade,
}) {
  const regenSec = profile?.regenSeconds ?? (profile?.energyRegenIntervalMs ?? 5000) / 1000;

  return (
    <>
      {error ? (
        <p className="mineError mono" role="alert">
          {error}
          <button type="button" className="mineError__dismiss" onClick={() => setError("")}>
            ×
          </button>
        </p>
      ) : null}

      {referralClaimMsg ? (
        <p className="mineSuccess mono" role="status">
          {referralClaimMsg}
        </p>
      ) : null}

      <MineLevelCard profile={profile} />

      <section className="mineStatsGrid" aria-label="Mining stats">
        <StatCard label="Shards" value={profile?.shards ?? 0} accent />
        <StatCard label="Per tap" value={profile?.shardsPerTap ?? 1} />
        <StatCard label="Total XP" value={profile?.xp ?? 0} />
        <StatCard label="Regen" value={`${regenSec}s`} />
      </section>

      <MineLevelUpModal levelUp={levelUp} onClose={dismissLevelUp} />

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
      </section>

      <section className="mineTapZone">
        <div className="mineTapGlow" aria-hidden="true" />
        <motion.button
          type="button"
          className="mineTapBtn"
          disabled={(profile?.energy ?? 0) <= 0}
          whileTap={{ scale: 0.94 }}
          animate={
            tapping
              ? { boxShadow: "0 0 48px rgba(56, 189, 248, 0.55)" }
              : { boxShadow: "0 0 32px rgba(99, 102, 241, 0.35)" }
          }
          onPointerDown={(e) => {
            e.preventDefault();
            hapticImpact("light");
            tap(1);
          }}
          style={{ touchAction: "manipulation" }}
        >
          <span className="mineTapBtn__ring" aria-hidden="true" />
          <span className="mineTapBtn__label">Mine Shards</span>
          <span className="mineTapBtn__sub mono">
            {(profile?.energy ?? 0) <= 0
              ? "Recharging…"
              : `+${profile?.shardsPerTap ?? 1}/tap · batch ${profile?.maxTapBatch ?? 5} · ${profile?.maxTapsPerSecond ?? 10}/s`}
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
          onClick={() => {
            hapticImpact("light");
            claimDaily();
          }}
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
              onBuy={(id) => {
                hapticImpact("light");
                purchaseUpgrade(id);
              }}
              purchasing={upgradingId}
              flashSuccess={upgradeFlash}
            />
          ))}
        </div>
      </section>
    </>
  );
}

export default function Mine() {
  const [view, setView] = useState("play");
  const mining = useMining();

  if (mining.loading && !mining.profile) {
    return <MineSkeleton />;
  }

  return (
    <main className="minePage">
      <header className="mineHeader">
        <div>
          <p className="mineHeader__kicker mono">QUANTON MINING</p>
          <h1 className="mineHeader__title">Shard Mine</h1>
        </div>
        <button type="button" className="mineHeader__refresh mono" onClick={() => mining.refresh()}>
          Sync
        </button>
      </header>

      <nav className="mineViewNav" aria-label="Mining sections">
        {MINE_VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`mineViewNav__btn mono ${view === v.id ? "mineViewNav__btn--active" : ""}`}
            onClick={() => {
              hapticImpact("light");
              setView(v.id);
            }}
          >
            {v.label}
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait">
        {view === "play" ? (
          <motion.div
            key="play"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2 }}
          >
            <MinePlayView {...mining} />
          </motion.div>
        ) : null}
        {view === "ranks" ? (
          <motion.div
            key="ranks"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2 }}
          >
            <MineLeaderboard />
          </motion.div>
        ) : null}
        {view === "invite" ? (
          <motion.div
            key="invite"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2 }}
          >
            <MineReferralCard
              referral={mining.referral}
              loading={mining.referralLoading}
              onCopy={() => mining.loadReferral()}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <p className="mineFooterNote mono">
        Shards are off-chain. Climb ranks and invite friends — no tokens or withdrawals.
      </p>
    </main>
  );
}
