import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMining } from "../hooks/useMining.js";
import MineCrystal from "../components/mine/MineCrystal.jsx";
import MineSideDock from "../components/mine/MineSideDock.jsx";
import MineUpgradeCard from "../components/mine/MineUpgradeCard.jsx";
import MineProfilePanel from "../components/mine/MineProfilePanel.jsx";
import MineLeaderboard from "../components/MineLeaderboard.jsx";
import MineLevelCard from "../components/MineLevelCard.jsx";
import MineLevelUpModal from "../components/MineLevelUpModal.jsx";
import { hapticImpact } from "../lib/telegramUser.js";

const UPGRADE_ORDER = ["multi_tap", "turbo_miner", "bigger_battery", "faster_recharge"];

function sortUpgrades(upgrades = []) {
  return [...upgrades].sort(
    (a, b) => UPGRADE_ORDER.indexOf(a.id) - UPGRADE_ORDER.indexOf(b.id)
  );
}

function StatPill({ label, value, progress }) {
  return (
    <div className="mineStatPill glass">
      <div className="mineStatPill__meta">
        <span className="mineStatPill__label">{label}</span>
        <motion.span
          key={String(value)}
          className="mineStatPill__value mono"
          initial={{ opacity: 0.6, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {value}
        </motion.span>
        {progress != null ? (
          <div className="mineStatPill__track">
            <motion.div
              className="mineStatPill__fill"
              initial={false}
              animate={{ width: `${progress}%` }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MineSkeleton() {
  return (
    <div className="minePage minePage--loading" aria-busy="true">
      <div className="mineSkeleton mineSkeleton--level" />
      <div className="mineSkeletonRow">
        <div className="mineSkeleton mineSkeleton--pill" />
        <div className="mineSkeleton mineSkeleton--pill" />
        <div className="mineSkeleton mineSkeleton--pill" />
      </div>
      <div className="mineSkeleton mineSkeleton--arena" />
      <div className="mineSkeleton mineSkeleton--upg" />
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
  setView,
  tap,
  claimDaily,
  purchaseUpgrade,
}) {
  const sortedUpgrades = useMemo(() => sortUpgrades(profile?.upgrades), [profile?.upgrades]);
  const regenSec = profile?.regenSeconds ?? (profile?.energyRegenIntervalMs ?? 5000) / 1000;

  const leftActions = [
    {
      id: "daily",
      label: "Daily",
      badge: profile?.canClaimDaily ? "!" : null,
      disabled: !profile?.canClaimDaily,
      highlight: profile?.canClaimDaily,
      onClick: () => {
        hapticImpact("light");
        claimDaily();
      },
    },
    {
      id: "missions",
      label: "Missions",
      disabled: true,
      onClick: () => hapticImpact("light"),
    },
  ];

  const rightActions = [
    {
      id: "invite",
      label: "Invite",
      onClick: () => {
        hapticImpact("light");
        setView("profile");
      },
    },
    {
      id: "boost",
      label: "Boost",
      disabled: true,
      onClick: () => hapticImpact("light"),
    },
    {
      id: "crates",
      label: "Crates",
      disabled: true,
      onClick: () => hapticImpact("light"),
    },
    {
      id: "leaders",
      label: "Leaders",
      highlight: true,
      onClick: () => {
        hapticImpact("light");
        setView("ranks");
      },
    },
  ];

  return (
    <>
      {error ? (
        <p className="mineToast mineToast--error mono" role="alert">
          {error}
          <button type="button" onClick={() => setError("")} aria-label="Dismiss">
            ×
          </button>
        </p>
      ) : null}

      {referralClaimMsg ? (
        <p className="mineToast mineToast--ok mono" role="status">
          {referralClaimMsg}
        </p>
      ) : null}

      <MineLevelCard profile={profile} />
      <MineLevelUpModal levelUp={levelUp} onClose={dismissLevelUp} />

      <div className="mineStatStrip">
        <StatPill
          label="Energy"
          value={`${profile?.energy ?? 0}/${profile?.maxEnergy ?? 0}`}
          progress={energyPct}
        />
        <StatPill label="Per tap" value={profile?.shardsPerTap ?? 1} />
        <StatPill label="Speed" value={`${profile?.maxTapsPerSecond ?? 10}/s`} />
      </div>

      <section className="mineArena" aria-label="Mining">
        <MineSideDock side="left" actions={leftActions} />
        <MineCrystal
          profile={profile}
          tapping={tapping}
          floats={floats}
          onTap={(n) => {
            hapticImpact("light");
            tap(n);
          }}
        />
        <MineSideDock side="right" actions={rightActions} />
      </section>

      <p className="mineArenaHint mono">Regen +1 energy / {regenSec}s · batch up to {profile?.maxTapBatch ?? 5}</p>

      <section className="mineUpgradesSection">
        <div className="mineSectionHead">
          <h2>Upgrades</h2>
          <span className="mineSectionHead__sub mono">Power up your mine</span>
        </div>
        <div className="mineUpgradesGrid">
          {sortedUpgrades.map((u) => (
            <MineUpgradeCard
              key={u.id}
              upgrade={u}
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
      <header className="mineTopBar glass">
        <div>
          <p className="mineTopBar__kicker mono">QUANTON</p>
          <h1 className="mineTopBar__title">Shard Mining</h1>
        </div>
        <button type="button" className="mineTopBar__sync mono" onClick={() => mining.refresh()}>
          Sync
        </button>
      </header>

      <nav className="mineTabs glass" aria-label="Mining views">
        {[
          { id: "play", label: "Mine" },
          { id: "ranks", label: "Ranks" },
          { id: "profile", label: "Profile" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`mineTabs__btn mono ${view === tab.id ? "mineTabs__btn--active" : ""}`}
            onClick={() => {
              hapticImpact("light");
              setView(tab.id);
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="mineScroll">
        <AnimatePresence mode="wait">
          {view === "play" ? (
            <motion.div
              key="play"
              className="mineView"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <MinePlayView {...mining} setView={setView} />
            </motion.div>
          ) : null}
          {view === "ranks" ? (
            <motion.div
              key="ranks"
              className="mineView"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <div className="minePanel glass">
                <MineLeaderboard />
              </div>
            </motion.div>
          ) : null}
          {view === "profile" ? (
            <motion.div
              key="profile"
              className="mineView"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <MineProfilePanel
                profile={mining.profile}
                referral={mining.referral}
                loading={mining.referralLoading}
                onCopy={() => mining.loadReferral()}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </main>
  );
}
