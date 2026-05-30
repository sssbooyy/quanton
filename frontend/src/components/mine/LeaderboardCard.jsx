import { sapphireNumber } from "../../lib/sapphireFormat.js";

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="sapphire-leaderboard__skeletonRow">
          <td colSpan={3}>
            <div className="sapphire-leaderboard__skeletonBar" />
          </td>
        </tr>
      ))}
    </>
  );
}

export default function LeaderboardCard({ entries = [], loading, error, viewerEntry }) {
  const viewerId = viewerEntry?.telegramId;

  return (
    <section className="sapphire-leaderboard sapphire-glass" aria-label="Leaderboard">
      <h2 className="sapphire-sectionTitle">Leaderboard</h2>

      {error ? (
        <p className="sapphire-leaderboard__error sapphire-mono" role="alert">
          {error}
        </p>
      ) : null}

      <table className="sapphire-leaderboard__table">
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Username</th>
            <th scope="col">Total Shards</th>
          </tr>
        </thead>
        <tbody>
          {loading && !entries.length ? (
            <SkeletonRows />
          ) : (
            entries.map((entry) => (
              <tr
                key={entry.telegramId || entry.rank}
                className={viewerId && entry.telegramId === viewerId ? "sapphire-leaderboard__you" : undefined}
              >
                <td className="sapphire-leaderboard__rank sapphire-mono">#{entry.rank}</td>
                <td className="sapphire-leaderboard__name">{entry.username || "—"}</td>
                <td className="sapphire-mono">{sapphireNumber(entry.shards)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {!loading && !entries.length && !error ? (
        <p className="sapphire-leaderboard__empty sapphire-mono">No leaderboard data yet.</p>
      ) : null}
    </section>
  );
}
