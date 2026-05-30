import { sapphireNumber } from "../../lib/sapphireFormat.js";

export default function MiningOverviewCard({ profile, loading }) {
  const shards = profile?.shards;
  const dailyField = profile?.dailyEarnings ?? profile?.shardsEarnedToday;

  return (
    <section className="sapphire-overview sapphire-glass sapphire-glow" aria-label="Mining overview">
      <h2 className="sapphire-sectionTitle">Overview</h2>
      <div className="sapphire-overview__grid">
        <div className="sapphire-overview__metric">
          <span className="sapphire-label">Total Shards</span>
          <span className="sapphire-value sapphire-mono">
            {loading && shards == null ? "—" : sapphireNumber(shards)}
          </span>
        </div>
        <div className="sapphire-overview__metric">
          <span className="sapphire-label">Daily Earnings</span>
          <span className="sapphire-value sapphire-mono">
            {dailyField == null ? "—" : sapphireNumber(dailyField)}
          </span>
        </div>
      </div>
      <div className="sapphire-overview__chart" aria-hidden="true">
        <span className="sapphire-overview__chartLabel">Growth chart placeholder</span>
        <div className="sapphire-overview__chartBars">
          {[28, 42, 36, 52, 44, 58, 48].map((h, i) => (
            <span key={i} className="sapphire-overview__chartBar" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </section>
  );
}
