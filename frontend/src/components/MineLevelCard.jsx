import { motion } from "framer-motion";

export default function MineLevelCard({ profile }) {
  if (!profile) return null;

  const tier = profile.levelTier || "rookie";
  const pct = profile.progressPercent ?? 0;
  const color = profile.levelColor || "#38bdf8";
  const level = profile.level ?? 1;

  return (
    <motion.section
      className={`mineLevelCard glass mineLevelCard--tier-${tier}`}
      style={{ "--level-color": color }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      aria-label="Level progress"
    >
      <div className="mineLevelCard__row">
        <div className="mineLevelCard__badge mono" aria-hidden="true">
          {tier.slice(0, 2).toUpperCase()}
        </div>

        <div className="mineLevelCard__main">
          <p className="mineLevelCard__level mono">Level {level}</p>
          <p className="mineLevelCard__title">{profile.levelTitle || "Rookie Miner"}</p>
          <div className="mineLevelCard__track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <motion.div
              className="mineLevelCard__fill"
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 22 }}
            />
          </div>
          <p className="mineLevelCard__xp mono">
            {profile.currentLevelXp ?? 0} / {profile.nextLevelXp ?? 100} XP
          </p>
        </div>

        <div className="mineLevelCard__aside">
          {profile.nextRank ? (
            <>
              <div className="mineLevelCard__nextBlock">
                <span className="mineLevelCard__nextLabel mono">Next rank</span>
                <span className="mineLevelCard__nextTitle">{profile.nextRank.nextRankTitle}</span>
                <span className="mineLevelCard__nextLvl mono">
                  at Level {profile.nextRank.nextRankAtLevel}
                </span>
              </div>
              <span className="mineLevelCard__chevron" aria-hidden="true">
                ›
              </span>
            </>
          ) : (
            <span className="mineLevelCard__maxed mono">Legendary</span>
          )}
        </div>
      </div>
    </motion.section>
  );
}
