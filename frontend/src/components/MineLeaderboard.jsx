import { motion } from "framer-motion";
import {
  formatLeaderboardStat,
  leaderboardStatLabel,
  useMiningLeaderboard,
} from "../hooks/useMiningLeaderboard.js";

function Avatar({ entry }) {
  const initial = (entry.firstName || entry.username || "?").charAt(0).toUpperCase();
  if (entry.photoUrl) {
    return <img className="mineLbAvatar" src={entry.photoUrl} alt="" loading="lazy" />;
  }
  return <span className="mineLbAvatar mineLbAvatar--fallback">{initial}</span>;
}

function LeaderboardRow({ entry, type, isViewer }) {
  const top = entry.rank <= 3;
  return (
    <motion.li
      className={`mineLbRow ${top ? `mineLbRow--top${entry.rank}` : ""} ${isViewer ? "mineLbRow--you" : ""}`}
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
    >
      <span className="mineLbRow__rank mono">#{entry.rank}</span>
      <Avatar entry={entry} />
      <div className="mineLbRow__meta">
        <span className="mineLbRow__name">{entry.username}</span>
        <span
          className="mineLbRow__sub mono"
          style={{ color: entry.levelColor || undefined }}
        >
          Lv {entry.level ?? 1} · {entry.levelTitle || "Miner"}
        </span>
      </div>
      <span className="mineLbRow__stat mono">
        {formatLeaderboardStat(entry, type)}
        <span className="mineLbRow__statLabel">{leaderboardStatLabel(type)}</span>
      </span>
    </motion.li>
  );
}

function LeaderboardSkeleton() {
  return (
    <ul className="mineLbList mineLbList--loading" aria-busy="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i} className="mineLbSkeleton" />
      ))}
    </ul>
  );
}

export default function MineLeaderboard() {
  const lb = useMiningLeaderboard(true);

  return (
    <section className="mineLb" aria-label="Leaderboard">
      <div className="mineLbTabs" role="tablist">
        {lb.types.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={lb.type === t}
            className={`mineLbTabs__btn mono ${lb.type === t ? "mineLbTabs__btn--active" : ""}`}
            onClick={() => lb.setLeaderboardType(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {lb.error ? (
        <p className="mineToast mineToast--error mono" role="alert">
          {lb.error}
        </p>
      ) : null}

      {lb.viewerEntry && !lb.entries.some((e) => e.telegramId === lb.viewerEntry.telegramId) ? (
        <div className="mineLbYou">
          <p className="mineLbYou__label mono">Your rank</p>
          <LeaderboardRow entry={lb.viewerEntry} type={lb.type} isViewer />
        </div>
      ) : null}

      {lb.loading && !lb.entries.length ? (
        <LeaderboardSkeleton />
      ) : (
        <ul className="mineLbList">
          {lb.entries.map((entry) => (
            <LeaderboardRow
              key={entry.telegramId || entry.rank}
              entry={entry}
              type={lb.type}
              isViewer={lb.viewerEntry?.telegramId === entry.telegramId}
            />
          ))}
        </ul>
      )}

      {!lb.loading && !lb.entries.length ? (
        <p className="mineLbEmpty mono">No miners on the board yet. Be the first!</p>
      ) : null}
    </section>
  );
}
