import { sapphireDisplay, sapphireNumber } from "../../lib/sapphireFormat.js";

export default function LevelProgressCard({ profile }) {
  const pct = profile?.progressPercent ?? 0;
  const level = profile?.level;
  const rank = profile?.levelTitle;
  const currentXp = profile?.currentLevelXp;
  const nextXp = profile?.nextLevelXp;
  const nextLevel = level != null ? level + 1 : null;

  return (
    <section className="sapphire-level sapphire-glass" aria-label="Level progress">
      <h2 className="sapphire-sectionTitle">Level Progress</h2>

      <div className="sapphire-level__row">
        <div>
          <p className="sapphire-level__rank">{sapphireDisplay(rank)}</p>
          <p className="sapphire-mono sapphire-empty" style={{ margin: "2px 0 0", fontSize: "10px" }}>
            {sapphireDisplay(level != null ? `Level ${level}` : null)}
          </p>
        </div>
        <p className="sapphire-level__num sapphire-mono">
          {currentXp != null && nextXp != null ? `${currentXp} / ${nextXp} XP` : "—"}
        </p>
      </div>

      <div
        className="sapphire-level__track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="sapphire-level__fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="sapphire-level__meta sapphire-mono">
        <span>Current XP: {sapphireNumber(currentXp)}</span>
        <span>Next level: {sapphireDisplay(nextLevel, sapphireNumber)}</span>
      </div>

      <div className="sapphire-level__next">
        <span className="sapphire-label">Next rank</span>
        {profile?.nextRank ? (
          <span className="sapphire-level__nextTitle">
            {profile.nextRank.nextRankTitle} · Lv {profile.nextRank.nextRankAtLevel}
          </span>
        ) : (
          <span className="sapphire-empty">—</span>
        )}
      </div>
    </section>
  );
}
