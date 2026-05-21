import { motion, AnimatePresence } from "framer-motion";
import { hapticNotification } from "../lib/telegramUser.js";
import MineIcon from "./mine/MineIcon.jsx";
import { mineIcons } from "../lib/mineIcons.js";

export default function MineLevelUpModal({ levelUp, onClose }) {
  if (!levelUp) return null;

  const tiers = levelUp.levelsGained?.length
    ? levelUp.levelsGained
    : [{ level: levelUp.newLevel, shards: levelUp.levelRewardsEarned, levelTitle: levelUp.levelTitle }];

  const top = tiers[tiers.length - 1];

  return (
    <AnimatePresence>
      <motion.div
        className="mineLevelUpBackdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        role="presentation"
      >
        <motion.div
          className="mineLevelUpModal"
          initial={{ scale: 0.85, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-labelledby="level-up-title"
        >
          <div className="mineLevelUpModal__burst" aria-hidden="true" />
          <div className="mineLevelUpModal__icon">
            <MineIcon src={mineIcons.levelUp} size={72} glow="purple" pulse lazy={false} />
          </div>
          <p className="mineLevelUpModal__kicker mono">LEVEL UP</p>
          <h2 id="level-up-title" className="mineLevelUpModal__title">
            Level {top.level}
          </h2>
          <p className="mineLevelUpModal__rank">{top.levelTitle}</p>
          {tiers.length > 1 ? (
            <p className="mineLevelUpModal__multi mono">+{tiers.length} levels at once!</p>
          ) : null}
          <p className="mineLevelUpModal__reward mono">
            +{(levelUp.levelRewardsEarned ?? top.shards ?? 0).toLocaleString()} shards bonus
          </p>
          <button
            type="button"
            className="mineLevelUpModal__btn"
            onClick={() => {
              hapticNotification("success");
              onClose();
            }}
          >
            Continue mining
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
