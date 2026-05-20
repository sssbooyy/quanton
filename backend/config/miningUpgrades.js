/** Quanton Mining upgrade catalog, costs, and effect calculators. */

export const BASE_MAX_ENERGY = 1000;
export const ENERGY_REGEN_BASE_MS = 5000;
export const MIN_REGEN_INTERVAL_MS = 1000;
export const REGEN_MS_REDUCTION_PER_LEVEL = 500;

export const UPGRADE_IDS = ["bigger_battery", "turbo_miner", "faster_recharge"];

export const UPGRADE_CATALOG = {
  bigger_battery: {
    id: "bigger_battery",
    name: "Bigger Battery",
    description: "+250 max energy per level.",
    maxLevel: 50,
    costBase: 250,
    energyPerLevel: 250,
  },
  turbo_miner: {
    id: "turbo_miner",
    name: "Turbo Miner",
    description: "+1 shard per tap per level.",
    maxLevel: 50,
    costBase: 500,
    shardsPerLevel: 1,
  },
  faster_recharge: {
    id: "faster_recharge",
    name: "Faster Recharge",
    description: "−0.5s energy regen interval per level (min 1s).",
    maxLevel: 50,
    costBase: 750,
  },
};

export function defaultUpgrades() {
  return UPGRADE_IDS.map((id) => ({ id, level: 0 }));
}

export function isValidUpgradeId(upgradeId) {
  return Boolean(UPGRADE_CATALOG[upgradeId]);
}

export function getUpgradeLevel(user, upgradeId) {
  const row = (user.upgrades || []).find((u) => u.id === upgradeId);
  return Math.max(0, Math.floor(Number(row?.level) || 0));
}

export function setUpgradeLevel(user, upgradeId, level) {
  if (!Array.isArray(user.upgrades)) user.upgrades = defaultUpgrades();
  const row = user.upgrades.find((u) => u.id === upgradeId);
  const next = Math.max(0, Math.floor(level));
  if (row) row.level = next;
  else user.upgrades.push({ id: upgradeId, level: next });
  user.markModified?.("upgrades");
}

/** Next purchase cost: costBase * (currentLevel + 1). */
export function upgradeCost(upgradeId, currentLevel) {
  const meta = UPGRADE_CATALOG[upgradeId];
  if (!meta) return null;
  const lvl = Math.max(0, Math.floor(Number(currentLevel) || 0));
  return meta.costBase * (lvl + 1);
}

export function computeMaxEnergy(user) {
  const batteryLevel = getUpgradeLevel(user, "bigger_battery");
  return BASE_MAX_ENERGY + batteryLevel * UPGRADE_CATALOG.bigger_battery.energyPerLevel;
}

export function computeRegenIntervalMs(user) {
  const lvl = getUpgradeLevel(user, "faster_recharge");
  const interval = ENERGY_REGEN_BASE_MS - lvl * REGEN_MS_REDUCTION_PER_LEVEL;
  return Math.max(MIN_REGEN_INTERVAL_MS, interval);
}

export function computeRegenSeconds(user) {
  return computeRegenIntervalMs(user) / 1000;
}

/** Shards earned per tap (Turbo Miner + miningPower). */
export function computeShardsPerTap(user) {
  const turbo = getUpgradeLevel(user, "turbo_miner");
  const base = 1 + turbo * (UPGRADE_CATALOG.turbo_miner.shardsPerLevel || 1);
  const power = Math.max(1, Math.floor(Number(user.miningPower) || 1));
  return Math.max(1, base * power);
}

export function nextMaxEnergyAfterUpgrade(user) {
  const nextLevel = getUpgradeLevel(user, "bigger_battery") + 1;
  return BASE_MAX_ENERGY + nextLevel * UPGRADE_CATALOG.bigger_battery.energyPerLevel;
}

export function nextRegenSecondsAfterUpgrade(user) {
  const nextLevel = getUpgradeLevel(user, "faster_recharge") + 1;
  const ms = Math.max(
    MIN_REGEN_INTERVAL_MS,
    ENERGY_REGEN_BASE_MS - nextLevel * REGEN_MS_REDUCTION_PER_LEVEL
  );
  return ms / 1000;
}

export function nextShardsPerTapAfterUpgrade(user) {
  const turbo = getUpgradeLevel(user, "turbo_miner") + 1;
  const power = Math.max(1, Math.floor(Number(user.miningPower) || 1));
  return Math.max(1, (1 + turbo) * power);
}

export function upgradeEffectPreview(upgradeId, user) {
  const lvl = getUpgradeLevel(user, upgradeId);
  switch (upgradeId) {
    case "bigger_battery":
      return { current: computeMaxEnergy(user), next: nextMaxEnergyAfterUpgrade(user), unit: "max energy" };
    case "turbo_miner":
      return { current: computeShardsPerTap(user), next: nextShardsPerTapAfterUpgrade(user), unit: "shards/tap" };
    case "faster_recharge":
      return { current: computeRegenSeconds(user), next: nextRegenSecondsAfterUpgrade(user), unit: "regen (s)" };
    default:
      return { current: lvl, next: lvl + 1, unit: "level" };
  }
}

export function buildUpgradeProfileRow(user, upgradeId) {
  const meta = UPGRADE_CATALOG[upgradeId];
  const level = getUpgradeLevel(user, upgradeId);
  const maxLevel = meta?.maxLevel ?? 50;
  const isMaxed = level >= maxLevel;
  const cost = isMaxed ? null : upgradeCost(upgradeId, level);
  const shards = Math.max(0, Number(user.shards) || 0);
  const preview = upgradeEffectPreview(upgradeId, user);

  return {
    id: upgradeId,
    level,
    maxLevel,
    name: meta?.name || upgradeId,
    description: meta?.description || "",
    nextCost: cost,
    canAfford: cost != null && shards >= cost,
    isMaxed,
    nextEffect: isMaxed
      ? null
      : `${preview.unit}: ${formatEffectValue(upgradeId, preview.current)} → ${formatEffectValue(upgradeId, preview.next)}`,
  };
}

function formatEffectValue(upgradeId, value) {
  if (upgradeId === "faster_recharge") return `${Number(value).toFixed(1)}s`;
  if (upgradeId === "turbo_miner") return String(Math.floor(value));
  return String(Math.floor(value));
}
