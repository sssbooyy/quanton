import { User } from "../models/User.js";

/** +1 energy every 5 seconds (backend source of truth). */
export const ENERGY_REGEN_INTERVAL_MS = 5000;
const MAX_TAPS_PER_SECOND = 10;
const MIN_TAP_INTERVAL_MS = 50;
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const tapRateBuckets = new Map();

export const UPGRADE_CATALOG = {
  bigger_battery: {
    id: "bigger_battery",
    name: "Bigger Battery",
    description: "Increases maximum energy storage.",
    maxLevel: 10,
    energyPerLevel: 100,
  },
  turbo_miner: {
    id: "turbo_miner",
    name: "Turbo Miner",
    description: "Boosts shard rewards per tap.",
    maxLevel: 10,
    shardBonusPerLevel: 0.1,
  },
  faster_recharge: {
    id: "faster_recharge",
    name: "Faster Recharge",
    description: "Speeds up passive energy regeneration.",
    maxLevel: 10,
    regenMsReductionPerLevel: 200,
  },
};

const LEVEL_XP_THRESHOLDS = [0, 0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200];

export const MINING_DEFAULTS = {
  shards: 0,
  level: 1,
  xp: 0,
  energy: 1000,
  maxEnergy: 1000,
  miningPower: 1,
  dailyStreak: 0,
  totalTaps: 0,
};

function defaultUpgrades() {
  return Object.keys(UPGRADE_CATALOG).map((id) => ({ id, level: 0 }));
}

function levelFromXp(xp) {
  let level = 1;
  for (let i = LEVEL_XP_THRESHOLDS.length - 1; i >= 1; i--) {
    if (xp >= LEVEL_XP_THRESHOLDS[i]) level = i;
  }
  return Math.min(level, LEVEL_XP_THRESHOLDS.length - 1);
}

function xpToNextLevel(xp, level) {
  const next = level + 1;
  if (next >= LEVEL_XP_THRESHOLDS.length) return 0;
  const need = LEVEL_XP_THRESHOLDS[next];
  return Math.max(0, need - xp);
}

function getUpgradeLevel(user, upgradeId) {
  const row = (user.upgrades || []).find((u) => u.id === upgradeId);
  return Number(row?.level) || 0;
}

const PROFILE_ONLY_KEYS = new Set([
  "firstName",
  "lastName",
  "username",
  "languageCode",
  "isPremium",
  "photoUrl",
]);

function applyProfilePatch(user, profilePatch = {}) {
  if (!profilePatch || typeof profilePatch !== "object") return;
  for (const [key, value] of Object.entries(profilePatch)) {
    if (PROFILE_ONLY_KEYS.has(key)) user[key] = value;
  }
}

/** Fill missing mining fields only — never overwrite existing progress. */
function ensureMiningFields(user, { isNewUser = false } = {}) {
  const fill = (field, defaultValue) => {
    const current = user[field];
    if (typeof current === "number" && Number.isFinite(current)) return;
    if (current instanceof Date) return;
    if (field === "upgrades" && Array.isArray(current) && current.length) return;
    user[field] = defaultValue;
  };

  if (isNewUser) {
    user.shards = MINING_DEFAULTS.shards;
    user.level = MINING_DEFAULTS.level;
    user.xp = MINING_DEFAULTS.xp;
    user.energy = MINING_DEFAULTS.energy;
    user.maxEnergy = MINING_DEFAULTS.maxEnergy;
    user.miningPower = MINING_DEFAULTS.miningPower;
    user.dailyStreak = MINING_DEFAULTS.dailyStreak;
    user.totalTaps = MINING_DEFAULTS.totalTaps;
    user.upgrades = defaultUpgrades();
    user.energyUpdatedAt = new Date();
  } else {
    fill("shards", MINING_DEFAULTS.shards);
    fill("level", MINING_DEFAULTS.level);
    fill("xp", MINING_DEFAULTS.xp);
    fill("energy", MINING_DEFAULTS.energy);
    fill("maxEnergy", MINING_DEFAULTS.maxEnergy);
    fill("miningPower", MINING_DEFAULTS.miningPower);
    fill("dailyStreak", MINING_DEFAULTS.dailyStreak);
    fill("totalTaps", MINING_DEFAULTS.totalTaps);
    if (!user.energyUpdatedAt) user.energyUpdatedAt = new Date();
    if (!Array.isArray(user.upgrades) || !user.upgrades.length) {
      user.upgrades = defaultUpgrades();
    } else {
      const ids = new Set(user.upgrades.map((u) => u.id));
      for (const id of Object.keys(UPGRADE_CATALOG)) {
        if (!ids.has(id)) user.upgrades.push({ id, level: 0 });
      }
    }
  }
  recalcMaxEnergy(user);
  return user;
}

function recalcMaxEnergy(user) {
  const batteryLevel = getUpgradeLevel(user, "bigger_battery");
  const bonus = (UPGRADE_CATALOG.bigger_battery.energyPerLevel || 0) * batteryLevel;
  user.maxEnergy = MINING_DEFAULTS.maxEnergy + bonus;
  user.energy = Math.min(user.energy, user.maxEnergy);
}

function regenIntervalMs(user) {
  const lvl = getUpgradeLevel(user, "faster_recharge");
  const reduction = (UPGRADE_CATALOG.faster_recharge.regenMsReductionPerLevel || 0) * lvl;
  return Math.max(1000, ENERGY_REGEN_INTERVAL_MS - reduction);
}

export function applyEnergyRegeneration(user, now = Date.now()) {
  ensureMiningFields(user);
  const maxE = user.maxEnergy;
  if (user.energy >= maxE) {
    user.energyUpdatedAt = new Date(now);
    return user;
  }
  const updatedAt = user.energyUpdatedAt ? new Date(user.energyUpdatedAt).getTime() : now;
  const elapsed = Math.max(0, now - updatedAt);
  const interval = regenIntervalMs(user);
  const gained = Math.floor(elapsed / interval);
  if (gained > 0) {
    user.energy = Math.min(maxE, user.energy + gained);
    user.energyUpdatedAt = new Date(updatedAt + gained * interval);
  }
  return user;
}

function shardRewardPerTap(user) {
  const turbo = getUpgradeLevel(user, "turbo_miner");
  const mult = 1 + turbo * (UPGRADE_CATALOG.turbo_miner.shardBonusPerLevel || 0);
  return Math.max(1, Math.floor(user.miningPower * mult));
}

function checkTapRateLimit(telegramId) {
  const now = Date.now();
  let bucket = tapRateBuckets.get(telegramId);
  if (!bucket) {
    bucket = { timestamps: [], lastTapMs: 0, throttledUntil: 0 };
    tapRateBuckets.set(telegramId, bucket);
  }
  if (now < bucket.throttledUntil) {
    return { ok: false, reason: "throttled", retryAfterMs: bucket.throttledUntil - now };
  }
  if (now - bucket.lastTapMs < MIN_TAP_INTERVAL_MS) {
    bucket.throttledUntil = now + 500;
    console.warn("[mining] tap spam cooldown", { telegramId });
    return { ok: false, reason: "cooldown", retryAfterMs: 500 };
  }
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < 1000);
  if (bucket.timestamps.length >= MAX_TAPS_PER_SECOND) {
    bucket.throttledUntil = now + 2000;
    console.warn("[mining] tap rate limit exceeded", { telegramId, count: bucket.timestamps.length });
    return { ok: false, reason: "rate_limit", retryAfterMs: 2000 };
  }
  bucket.timestamps.push(now);
  bucket.lastTapMs = now;
  return { ok: true };
}

export function miningProfileResponse(user) {
  const upgrades = (user.upgrades || []).map((u) => {
    const meta = UPGRADE_CATALOG[u.id] || {};
    return {
      id: u.id,
      level: u.level,
      name: meta.name || u.id,
      description: meta.description || "",
      maxLevel: meta.maxLevel || 10,
    };
  });
  const level = levelFromXp(user.xp);
  return {
    telegramId: user.telegramId,
    shards: user.shards,
    energy: user.energy,
    maxEnergy: user.maxEnergy,
    level,
    xp: user.xp,
    xpToNextLevel: xpToNextLevel(user.xp, level),
    miningPower: user.miningPower,
    dailyStreak: user.dailyStreak,
    lastDailyClaim: user.lastDailyClaim || null,
    totalTaps: user.totalTaps,
    upgrades,
    energyRegenIntervalMs: regenIntervalMs(user),
    canClaimDaily: canClaimDailyReward(user),
    utilitySlots: {
      featuredListings: false,
      feeDiscounts: false,
      crates: false,
      premiumAnalytics: false,
      profileCosmetics: false,
    },
  };
}

function canClaimDailyReward(user, now = Date.now()) {
  if (!user.lastDailyClaim) return true;
  return now - new Date(user.lastDailyClaim).getTime() >= DAILY_COOLDOWN_MS;
}

export async function getOrCreateMiningUser(telegramId, profilePatch = {}) {
  const id = String(telegramId || "").trim();
  if (!id) return { error: "telegramId is required." };

  let user = await User.findOne({ telegramId: id });
  const isNewUser = !user;

  console.log("[mining] resolve user", {
    telegramId: id,
    found: !isNewUser,
    action: isNewUser ? "create" : "load",
    shardsBefore: user?.shards,
    energyBefore: user?.energy,
  });

  if (isNewUser) {
    user = new User({
      telegramId: id,
      upgrades: defaultUpgrades(),
      energyUpdatedAt: new Date(),
    });
    applyProfilePatch(user, profilePatch);
    ensureMiningFields(user, { isNewUser: true });
  } else {
    applyProfilePatch(user, profilePatch);
    ensureMiningFields(user, { isNewUser: false });
  }

  const energyBeforeRegen = user.energy;
  applyEnergyRegeneration(user);
  await user.save();

  console.log("[mining] user saved", {
    telegramId: id,
    isNewUser,
    shards: user.shards,
    energy: user.energy,
    energyBeforeRegen,
    xp: user.xp,
    totalTaps: user.totalTaps,
  });

  return { user, isNewUser };
}

export async function getMiningProfile(telegramId, profilePatch = {}) {
  const out = await getOrCreateMiningUser(telegramId, profilePatch);
  if (out.error) return out;
  return { profile: miningProfileResponse(out.user), isNewUser: out.isNewUser };
}

export async function processMiningTap(telegramId, { tapCount = 1 } = {}) {
  const id = String(telegramId || "").trim();
  if (!id) return { error: "telegramId is required." };

  const rate = checkTapRateLimit(id);
  if (!rate.ok) {
    return { error: "Too many taps. Please slow down.", code: rate.reason, retryAfterMs: rate.retryAfterMs };
  }

  let user = await User.findOne({ telegramId: id });
  if (!user) {
    const created = await getOrCreateMiningUser(id);
    if (created.error) return created;
    user = created.user;
  } else {
    ensureMiningFields(user, { isNewUser: false });
    applyEnergyRegeneration(user);
  }

  const taps = Math.min(Math.max(1, Math.floor(Number(tapCount) || 1)), 5);
  const shardsBefore = user.shards;
  const energyBefore = user.energy;

  if (user.energy < taps) {
    await user.save();
    return {
      error: "Not enough energy.",
      code: "no_energy",
      profile: miningProfileResponse(user),
    };
  }

  const shardsEarned = shardRewardPerTap(user) * taps;
  user.energy -= taps;
  user.energyUpdatedAt = new Date();
  user.shards += shardsEarned;
  user.xp += taps;
  user.totalTaps += taps;
  user.level = levelFromXp(user.xp);
  await user.save();

  console.log("[mining] tap", {
    telegramId: id,
    taps,
    shardsBefore,
    shardsAfter: user.shards,
    shardsEarned,
    energyBefore,
    energyAfter: user.energy,
    totalTaps: user.totalTaps,
  });

  return {
    shardsEarned,
    taps,
    profile: miningProfileResponse(user),
  };
}

function dailyRewardForStreak(streak) {
  const base = 50;
  const bonus = Math.min(streak, 30) * 15;
  return base + bonus;
}

export async function claimDailyReward(telegramId) {
  const out = await getOrCreateMiningUser(telegramId);
  if (out.error) return out;
  const user = out.user;
  const now = Date.now();

  if (!canClaimDailyReward(user, now)) {
    const nextAt = new Date(new Date(user.lastDailyClaim).getTime() + DAILY_COOLDOWN_MS);
    return {
      error: "Daily reward already claimed.",
      code: "daily_cooldown",
      nextClaimAt: nextAt.toISOString(),
      profile: miningProfileResponse(user),
    };
  }

  const last = user.lastDailyClaim ? new Date(user.lastDailyClaim).getTime() : 0;
  const withinStreakWindow = last && now - last < DAILY_COOLDOWN_MS * 2;
  user.dailyStreak = withinStreakWindow ? user.dailyStreak + 1 : 1;
  user.lastDailyClaim = new Date(now);
  const reward = dailyRewardForStreak(user.dailyStreak);
  user.shards += reward;
  user.xp += Math.floor(reward / 2);
  user.level = levelFromXp(user.xp);
  await user.save();

  console.log("[mining] daily claim", { telegramId, streak: user.dailyStreak, reward });

  return {
    reward,
    streak: user.dailyStreak,
    profile: miningProfileResponse(user),
  };
}
