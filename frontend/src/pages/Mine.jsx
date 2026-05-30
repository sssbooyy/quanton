import { useMining } from "../hooks/useMining.js";
import { useMiningLeaderboard } from "../hooks/useMiningLeaderboard.js";
import { hapticImpact } from "../lib/telegramUser.js";
import MineLevelUpModal from "../components/MineLevelUpModal.jsx";
import MiningOverviewCard from "../components/mine/MiningOverviewCard.jsx";
import MiningReactor from "../components/mine/MiningReactor.jsx";
import MiningStatsRow from "../components/mine/MiningStatsRow.jsx";
import LevelProgressCard from "../components/mine/LevelProgressCard.jsx";
import UpgradesGrid from "../components/mine/UpgradesGrid.jsx";
import LeaderboardCard from "../components/mine/LeaderboardCard.jsx";
import ActivityFeed from "../components/mine/ActivityFeed.jsx";
import ProfileOverview from "../components/mine/ProfileOverview.jsx";
import ReferralCard from "../components/mine/ReferralCard.jsx";

function DashboardSkeleton() {
  return (
    <main className="sapphire-dashboard sapphire-dashboard--loading" aria-busy="true">
      <div className="sapphire-skeleton sapphire-skeleton--header" />
      <div className="sapphire-skeleton sapphire-skeleton--overview" />
      <div className="sapphire-skeleton sapphire-skeleton--reactor" />
      <div className="sapphire-skeleton sapphire-skeleton--stats" />
      <div className="sapphire-skeleton sapphire-skeleton--card" />
      <div className="sapphire-skeleton sapphire-skeleton--grid" />
    </main>
  );
}

export default function Mine() {
  const mining = useMining();
  const leaderboard = useMiningLeaderboard(true);

  if (mining.loading && !mining.profile) {
    return <DashboardSkeleton />;
  }

  return (
    <main className="sapphire-dashboard">
      <header className="sapphire-dashboard__header">
        <div>
          <p className="sapphire-dashboard__kicker sapphire-mono">QUANTON</p>
          <h1 className="sapphire-dashboard__title">Sapphire Mining</h1>
        </div>
        <button
          type="button"
          className="sapphire-dashboard__sync sapphire-mono"
          onClick={() => mining.refresh()}
        >
          Sync
        </button>
      </header>

      {mining.error ? (
        <p className="sapphire-dashboard__toast sapphire-dashboard__toast--error sapphire-mono" role="alert">
          {mining.error}
          <button type="button" onClick={() => mining.setError("")} aria-label="Dismiss">
            ×
          </button>
        </p>
      ) : null}

      {mining.referralClaimMsg ? (
        <p className="sapphire-dashboard__toast sapphire-dashboard__toast--ok sapphire-mono" role="status">
          {mining.referralClaimMsg}
        </p>
      ) : null}

      <MineLevelUpModal levelUp={mining.levelUp} onClose={mining.dismissLevelUp} />

      <div className="sapphire-dashboard__scroll">
        <MiningReactor
          profile={mining.profile}
          tapping={mining.tapping}
          floats={mining.floats}
          onTap={(n) => {
            hapticImpact("light");
            mining.tap(n);
          }}
        />

        <MiningStatsRow profile={mining.profile} energyPct={mining.energyPct} />

        <MiningOverviewCard profile={mining.profile} loading={mining.loading} />

        <LevelProgressCard profile={mining.profile} />

        <UpgradesGrid
          upgrades={mining.profile?.upgrades}
          onBuy={(id) => {
            hapticImpact("light");
            mining.purchaseUpgrade(id);
          }}
          purchasing={mining.upgradingId}
          flashSuccess={mining.upgradeFlash}
        />

        <LeaderboardCard
          entries={leaderboard.entries}
          loading={leaderboard.loading}
          error={leaderboard.error}
          viewerEntry={leaderboard.viewerEntry}
        />

        <ActivityFeed />

        <ProfileOverview profile={mining.profile} referral={mining.referral} />

        <ReferralCard referral={mining.referral} onCopy={() => mining.loadReferral()} />
      </div>
    </main>
  );
}
