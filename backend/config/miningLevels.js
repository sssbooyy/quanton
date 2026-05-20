/** Quanton Mining level curve, ranks, and level-up rewards. */

export const LEVEL_UP_SHARD_MULTIPLIER = 25;

export const LEVEL_RANKS = [
  { minLevel: 1, maxLevel: 4, title: "Rookie Miner", tier: "rookie", color: "#94a3b8" },
  { minLevel: 5, maxLevel: 9, title: "Gift Hunter", tier: "hunter", color: "#67e8f9" },
  { minLevel: 10, maxLevel: 19, title: "Shard Collector", tier: "collector", color: "#818cf8" },
  { minLevel: 20, maxLevel: 34, title: "Rare Seeker", tier: "seeker", color: "#a78bfa" },
  { minLevel: 35, maxLevel: 49, title: "Market Raider", tier: "raider", color: "#f472b6" },
  { minLevel: 50, maxLevel: 74, title: "Whale Scout", tier: "whale", color: "#fbbf24" },
  { minLevel: 75, maxLevel: 99, title: "Quanton Elite", tier: "elite", color: "#34d399" },
  { minLevel: 100, maxLevel: Infinity, title: "Legendary Trader", tier: "legendary", color: "#f97316" },
];

/** XP required to advance from `level` → `level + 1`. */
export function getXpForNextLevel(level) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  return Math.floor(100 * Math.pow(lv, 1.45));
}

/** Minimum total XP to be at `level` (level 1 = 0). */
export function totalXpForLevel(level) {
  const target = Math.max(1, Math.floor(Number(level) || 1));
  if (target <= 1) return 0;
  let total = 0;
  for (let i = 1; i < target; i++) {
    total += getXpForNextLevel(i);
  }
  return total;
}

export function levelFromXp(xp) {
  const x = Math.max(0, Math.floor(Number(xp) || 0));
  let level = 1;
  while (totalXpForLevel(level + 1) <= x) {
    level += 1;
    if (level >= 999) break;
  }
  return level;
}

export function getLevelRank(level) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  return (
    LEVEL_RANKS.find((r) => lv >= r.minLevel && lv <= r.maxLevel) ||
    LEVEL_RANKS[LEVEL_RANKS.length - 1]
  );
}

export function getLevelTitle(level) {
  return getLevelRank(level).title;
}

export function getLevelTier(level) {
  return getLevelRank(level).tier;
}

export function getLevelColor(level) {
  return getLevelRank(level).color;
}

/** Next rank tier above current level (for UI hint). */
export function getNextRankHint(level) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const current = getLevelRank(lv);
  const idx = LEVEL_RANKS.findIndex((r) => r.tier === current.tier);
  const next = LEVEL_RANKS[idx + 1];
  if (!next || lv >= next.minLevel) return null;
  return {
    nextRankTitle: next.title,
    nextRankAtLevel: next.minLevel,
    nextRankTier: next.tier,
    nextRankColor: next.color,
  };
}

export function getLevelMeta(level) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const rank = getLevelRank(lv);
  return {
    level: lv,
    levelTitle: rank.title,
    levelTier: rank.tier,
    levelColor: rank.color,
    nextRank: getNextRankHint(lv),
  };
}

export function calculateLevelProgress(level, xp) {
  const x = Math.max(0, Math.floor(Number(xp) || 0));
  const lv = levelFromXp(x);
  const floorXp = totalXpForLevel(lv);
  const ceilingXp = totalXpForLevel(lv + 1);
  const currentLevelXp = x - floorXp;
  const nextLevelXp = ceilingXp - floorXp;
  const progressPercent =
    nextLevelXp > 0 ? Math.min(100, Math.floor((currentLevelXp / nextLevelXp) * 100)) : 100;

  return {
    level: lv,
    xp: x,
    currentLevelXp,
    nextLevelXp,
    progressPercent,
    xpToNextLevel: Math.max(0, nextLevelXp - currentLevelXp),
    ...getLevelMeta(lv),
  };
}

export function levelUpShardReward(level) {
  return Math.max(1, Math.floor(Number(level) || 1)) * LEVEL_UP_SHARD_MULTIPLIER;
}

/**
 * Add XP server-side, sync level, pay per-level bonuses.
 * @returns {{ leveledUp, oldLevel, newLevel, levelRewardsEarned, levelsGained, levelTitle }}
 */
export function applyXpAndLevelRewards(user, xpToAdd) {
  const add = Math.max(0, Math.floor(Number(xpToAdd) || 0));
  const oldLevel = levelFromXp(user.xp);
  user.xp = Math.max(0, Math.floor(Number(user.xp) || 0)) + add;
  const newLevel = levelFromXp(user.xp);
  user.level = newLevel;

  let levelRewardsEarned = 0;
  const levelsGained = [];

  if (newLevel > oldLevel) {
    for (let L = oldLevel + 1; L <= newLevel; L++) {
      const bonus = levelUpShardReward(L);
      levelRewardsEarned += bonus;
      user.shards = Math.max(0, Math.floor(Number(user.shards) || 0)) + bonus;
      levelsGained.push({
        level: L,
        shards: bonus,
        levelTitle: getLevelTitle(L),
      });
    }
  }

  return {
    leveledUp: newLevel > oldLevel,
    oldLevel,
    newLevel,
    levelRewardsEarned,
    levelsGained,
    levelTitle: getLevelTitle(newLevel),
  };
}

export function buildLevelProfileFields(user) {
  const progress = calculateLevelProgress(user.level, user.xp);
  return {
    level: progress.level,
    xp: progress.xp,
    levelTitle: progress.levelTitle,
    levelTier: progress.levelTier,
    levelColor: progress.levelColor,
    currentLevelXp: progress.currentLevelXp,
    nextLevelXp: progress.nextLevelXp,
    progressPercent: progress.progressPercent,
    xpToNextLevel: progress.xpToNextLevel,
    nextRank: progress.nextRank,
  };
}

export function levelFieldsForLeaderboard(user) {
  const lv = levelFromXp(user.xp ?? 0);
  const meta = getLevelMeta(lv);
  return {
    level: lv,
    levelTitle: meta.levelTitle,
    levelTier: meta.levelTier,
    levelColor: meta.levelColor,
  };
}
