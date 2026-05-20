import { User } from "../models/User.js";
import { isDemoTelegramId } from "../config/miningReferral.js";

const LEADERBOARD_TYPES = new Set(["shards", "level", "taps", "referrals"]);
const LEADERBOARD_LIMIT = 100;

const SORT_BY_TYPE = {
  shards: { shards: -1, xp: -1, totalTaps: -1 },
  level: { level: -1, xp: -1, shards: -1 },
  taps: { totalTaps: -1, shards: -1, xp: -1 },
  referrals: { referralCount: -1, shards: -1, xp: -1 },
};

function leaderboardBadge(rank) {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return null;
}

function displayName(user) {
  const u = String(user.username || "").trim();
  if (u) return u.startsWith("@") ? u : `@${u}`;
  const first = String(user.firstName || "").trim();
  if (first) return first;
  return "Miner";
}

function statForType(user, type) {
  switch (type) {
    case "shards":
      return user.shards ?? 0;
    case "level":
      return user.level ?? 1;
    case "taps":
      return user.totalTaps ?? 0;
    case "referrals":
      return user.referralCount ?? 0;
    default:
      return 0;
  }
}

function mapLeaderboardRow(user, rank, type) {
  return {
    rank,
    telegramId: user.telegramId,
    username: displayName(user),
    firstName: user.firstName || "",
    photoUrl: user.photoUrl || "",
    level: user.level ?? 1,
    shards: user.shards ?? 0,
    totalTaps: user.totalTaps ?? 0,
    referralCount: user.referralCount ?? 0,
    stat: statForType(user, type),
    badge: leaderboardBadge(rank),
  };
}

export async function getMiningLeaderboard(type = "shards", viewerTelegramId = "") {
  const key = LEADERBOARD_TYPES.has(type) ? type : "shards";
  const viewerId = String(viewerTelegramId || "").trim();

  const users = await User.find({
    telegramId: { $not: /^demo_/ },
  })
    .sort(SORT_BY_TYPE[key])
    .limit(LEADERBOARD_LIMIT)
    .select(
      "telegramId username firstName photoUrl level shards totalTaps referralCount xp"
    )
    .lean();

  const entries = users.map((u, i) => mapLeaderboardRow(u, i + 1, key));

  let viewerRank = null;
  let viewerEntry = null;
  if (viewerId && !isDemoTelegramId(viewerId)) {
    const viewer = await User.findOne({ telegramId: viewerId })
      .select(
        "telegramId username firstName photoUrl level shards totalTaps referralCount xp"
      )
      .lean();
    if (viewer) {
      const sortField = key === "referrals" ? "referralCount" : key === "taps" ? "totalTaps" : key;
      const viewerVal = viewer[sortField] ?? 0;
      const ahead = await User.countDocuments({
        telegramId: { $not: /^demo_/ },
        [sortField]: { $gt: viewerVal },
      });
      viewerRank = ahead + 1;
      viewerEntry = { ...mapLeaderboardRow(viewer, viewerRank, key), isViewer: true };
    }
  }

  return {
    type: key,
    entries,
    viewerRank,
    viewerEntry,
  };
}
