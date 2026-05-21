import { motion } from "framer-motion";
import MineIcon from "./mine/MineIcon.jsx";
import { tierToBadge } from "../lib/mineIcons.js";

export default function MineLevelCard({ profile }) {
  if (!profile) return null;

  const tier = profile.levelTier || "rookie";
  const badgeSrc = tierToBadge(tier);
  const pct = profile.progressPercent ?? 0;
  const color = profile.levelColor || "#38bdf8";

  return (
    <motion.section
      className={`mineLevelCard mineLevelCard--tier-${tier}`}
      style={{ "--level-color": color }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      aria-label="Level progress"
    >
      <div className="mineLevelCard__glow" aria-hidden="true" />
      <div className="mineLevelCard__top">
        <div className="mineLevelCard__badge" aria-hidden="true">
          <span className="mineLevelCard__medal">
            <MineIcon src={badgeSrc} size={72} glow="purple" pulse className="mineIcon--hero" />
          </span>
          <span className="mineLevelCard__lvl mono">Lv {profile.level ?? 1}</span>
        </div>
        <div className="mineLevelCard__titles">
          <p className="mineLevelCard__kicker mono">RANK</p>
          <h2 className="mineLevelCard__title">{profile.levelTitle || "Rookie Miner"}</h2>
        </div>
      </div>

      <div className="mineLevelCard__xpLabels">
        <span className="mono">
          {profile.currentLevelXp ?? 0} / {profile.nextLevelXp ?? 100} XP
        </span>
        <span className="mono">{pct}%</span>
      </div>
      <div className="mineLevelCard__track">
        <motion.div
          className="mineLevelCard__fill"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
        />
      </div>

      {profile.nextRank ? (
        <p className="mineLevelCard__next mono">
          Next rank: <strong>{profile.nextRank.nextRankTitle}</strong> at Level{" "}
          {profile.nextRank.nextRankAtLevel}
        </p>
      ) : (
        <p className="mineLevelCard__next mono">Max rank achieved — Legendary status</p>
      )}
    </motion.section>
  );
}
