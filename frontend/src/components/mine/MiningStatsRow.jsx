import { sapphireDisplay, sapphireNumber } from "../../lib/sapphireFormat.js";

function StatCard({ label, value, progress }) {
  return (
    <article className="sapphire-statCard">
      <span className="sapphire-label">{label}</span>
      <span className="sapphire-value sapphire-mono">{value}</span>
      {progress != null ? (
        <div className="sapphire-statCard__track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="sapphire-statCard__fill" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
    </article>
  );
}

export default function MiningStatsRow({ profile, energyPct }) {
  const energyText =
    profile?.energy != null && profile?.maxEnergy != null
      ? `${profile.energy}/${profile.maxEnergy}`
      : null;

  const perTap = profile?.shardsPerTap;
  const speed = profile?.maxTapsPerSecond != null ? `${profile.maxTapsPerSecond}/s` : null;
  const level = profile?.level;

  return (
    <section className="sapphire-stats" aria-label="Mining stats">
      <StatCard
        label="Energy"
        value={sapphireDisplay(energyText)}
        progress={profile?.maxEnergy > 0 ? energyPct : null}
      />
      <StatCard label="Per Tap" value={sapphireDisplay(perTap, sapphireNumber)} />
      <StatCard label="Speed" value={sapphireDisplay(speed)} />
      <StatCard label="Level" value={sapphireDisplay(level, sapphireNumber)} />
    </section>
  );
}
