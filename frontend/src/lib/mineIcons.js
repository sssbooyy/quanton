import shards from "../assets/mine-icons/shards.png";
import gems from "../assets/mine-icons/gems.png";
import energy from "../assets/mine-icons/energy.png";
import rankBadge from "../assets/mine-icons/rank-badge.png";
import rankCrown from "../assets/mine-icons/rank-crown.png";
import levelUp from "../assets/mine-icons/level-up.png";
import mineTap from "../assets/mine-icons/mine-tap.png";
import multiplier from "../assets/mine-icons/multiplier.png";
import speedBoost from "../assets/mine-icons/speed-boost.png";
import daily from "../assets/mine-icons/daily.png";
import missions from "../assets/mine-icons/missions.png";
import invite from "../assets/mine-icons/invite.png";
import boost from "../assets/mine-icons/boost.png";
import crates from "../assets/mine-icons/crates.png";
import leaders from "../assets/mine-icons/leaders.png";
import navMarket from "../assets/mine-icons/nav-market.png";
import navMine from "../assets/mine-icons/nav-mine.png";
import navActivity from "../assets/mine-icons/nav-activity.png";
import navProfile from "../assets/mine-icons/nav-profile.png";
import multiTap from "../assets/mine-icons/multi-tap.png";
import turboMiner from "../assets/mine-icons/turbo-miner.png";
import battery from "../assets/mine-icons/battery.png";
import recharge from "../assets/mine-icons/recharge.png";
import crateCommon from "../assets/mine-icons/crate-common.png";
import crateRare from "../assets/mine-icons/crate-rare.png";
import crateEpic from "../assets/mine-icons/crate-epic.png";
import crownGold from "../assets/mine-icons/crown-gold.png";
import crownSilver from "../assets/mine-icons/crown-silver.png";
import crownBronze from "../assets/mine-icons/crown-bronze.png";
import topBadge from "../assets/mine-icons/top-badge.png";
import sync from "../assets/mine-icons/sync.png";
import close from "../assets/mine-icons/close.png";
import info from "../assets/mine-icons/info.png";
import settings from "../assets/mine-icons/settings.png";
import online from "../assets/mine-icons/online.png";
import offline from "../assets/mine-icons/offline.png";
import xp from "../assets/mine-icons/xp.png";
import time from "../assets/mine-icons/time.png";
import streak from "../assets/mine-icons/streak.png";
import reward from "../assets/mine-icons/reward.png";
import bonus from "../assets/mine-icons/bonus.png";
import protect from "../assets/mine-icons/protect.png";
import critical from "../assets/mine-icons/critical.png";
import lucky from "../assets/mine-icons/lucky.png";
import multiX10 from "../assets/mine-icons/multi-x10.png";
import autoMining from "../assets/mine-icons/auto-mining.png";
import badgeRookie from "../assets/mine-icons/badge-rookie.png";
import badgeGiftHunter from "../assets/mine-icons/badge-gift-hunter.png";
import badgeShardCollector from "../assets/mine-icons/badge-shard-collector.png";
import badgeRareSeeker from "../assets/mine-icons/badge-rare-seeker.png";
import badgeMarketRaider from "../assets/mine-icons/badge-market-raider.png";
import badgeWhaleScout from "../assets/mine-icons/badge-whale-scout.png";
import badgeQuantonElite from "../assets/mine-icons/badge-quanton-elite.png";
import badgeLegendary from "../assets/mine-icons/badge-legendary.png";

export const mineIcons = {
  shards,
  gems,
  energy,
  rankBadge,
  rankCrown,
  levelUp,
  mineTap,
  multiplier,
  speedBoost,
  daily,
  missions,
  invite,
  boost,
  crates,
  leaders,
  navMarket,
  navMine,
  navActivity,
  navProfile,
  multiTap,
  turboMiner,
  battery,
  recharge,
  crateCommon,
  crateRare,
  crateEpic,
  crownGold,
  crownSilver,
  crownBronze,
  topBadge,
  sync,
  close,
  info,
  settings,
  online,
  offline,
  xp,
  time,
  streak,
  reward,
  bonus,
  protect,
  critical,
  lucky,
  multiX10,
  autoMining,
  badgeRookie,
  badgeGiftHunter,
  badgeShardCollector,
  badgeRareSeeker,
  badgeMarketRaider,
  badgeWhaleScout,
  badgeQuantonElite,
  badgeLegendary,
};

const TIER_BADGES = {
  rookie: badgeRookie,
  hunter: badgeGiftHunter,
  collector: badgeShardCollector,
  seeker: badgeRareSeeker,
  raider: badgeMarketRaider,
  whale: badgeWhaleScout,
  elite: badgeQuantonElite,
  legendary: badgeLegendary,
};

const UPGRADE_ICONS = {
  multi_tap: multiTap,
  turbo_miner: turboMiner,
  bigger_battery: battery,
  faster_recharge: recharge,
};

const SIDE_DOCK_ICONS = {
  daily,
  missions,
  invite,
  boost,
  crates,
  leaders,
};

const CROWN_ICONS = {
  gold: crownGold,
  silver: crownSilver,
  bronze: crownBronze,
};

export function tierToBadge(tier) {
  return TIER_BADGES[tier] || badgeRookie;
}

export function upgradeToIcon(upgradeId) {
  return UPGRADE_ICONS[upgradeId] || shards;
}

export function sideDockIcon(actionId) {
  return SIDE_DOCK_ICONS[actionId] || info;
}

export function crownIcon(badge) {
  return CROWN_ICONS[badge] || null;
}
