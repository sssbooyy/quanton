import crypto from "crypto";
import { User } from "../models/User.js";
import {
  INVITEE_SHARD_REWARD,
  INVITEE_XP_REWARD,
  INVITER_SHARD_REWARD,
  INVITER_XP_REWARD,
  REFERRAL_CODE_CHARS,
  REFERRAL_CODE_LENGTH,
  buildReferralDeepLink,
  buildTelegramShareUrl,
  isDemoTelegramId,
  normalizeReferralCode,
} from "../config/miningReferral.js";

const LEVEL_XP_THRESHOLDS = [0, 0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200];

function levelFromXp(xp) {
  let level = 1;
  for (let i = LEVEL_XP_THRESHOLDS.length - 1; i >= 1; i--) {
    if (xp >= LEVEL_XP_THRESHOLDS[i]) level = i;
  }
  return Math.min(level, LEVEL_XP_THRESHOLDS.length - 1);
}

function generateReferralCodeCandidate() {
  const bytes = crypto.randomBytes(REFERRAL_CODE_LENGTH);
  let out = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    out += REFERRAL_CODE_CHARS[bytes[i] % REFERRAL_CODE_CHARS.length];
  }
  return out;
}

export async function ensureUserReferralCode(user) {
  if (user.referralCode) return user.referralCode;
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateReferralCodeCandidate();
    const exists = await User.exists({ referralCode: code });
    if (!exists) {
      user.referralCode = code;
      await user.save();
      return code;
    }
  }
  const fallback = `Q${String(user.telegramId).slice(-5).toUpperCase()}`.replace(/[^A-Z0-9]/g, "").slice(0, 6);
  user.referralCode = fallback || generateReferralCodeCandidate();
  await user.save();
  return user.referralCode;
}

export async function getReferralInfo(telegramId) {
  const id = String(telegramId || "").trim();
  if (!id) return { error: "telegramId is required." };

  let user = await User.findOne({ telegramId: id });
  if (!user) return { error: "User not found.", code: "user_not_found" };

  const code = await ensureUserReferralCode(user);
  const link = buildReferralDeepLink(code);
  const shareUrl = buildTelegramShareUrl(
    link,
    "Join Quanton Mining — tap shards, climb the leaderboard!"
  );

  return {
    referralCode: code,
    referralLink: link,
    shareUrl,
    referralCount: user.referralCount ?? 0,
    referralRewardsEarned: user.referralRewardsEarned ?? 0,
    invitedBy: user.invitedBy || null,
    rewardsDisabled: isDemoTelegramId(id),
    inviterReward: { shards: INVITER_SHARD_REWARD, xp: INVITER_XP_REWARD },
    inviteeReward: { shards: INVITEE_SHARD_REWARD, xp: INVITEE_XP_REWARD },
  };
}

export async function claimReferralReward(inviteeTelegramId, referralCodeInput, profilePatch = {}) {
  const inviteeId = String(inviteeTelegramId || "").trim();
  const code = normalizeReferralCode(referralCodeInput);

  if (!inviteeId) return { error: "telegramId is required." };
  if (!code) return { error: "Invalid referral code.", code: "invalid_referral_code" };

  if (isDemoTelegramId(inviteeId)) {
    return {
      error: "Referral rewards are disabled for demo accounts.",
      code: "demo_not_eligible",
    };
  }

  const inviter = await User.findOne({ referralCode: code });
  if (!inviter) {
    return { error: "Referral code not found.", code: "referral_not_found" };
  }

  if (isDemoTelegramId(inviter.telegramId)) {
    return { error: "This referral code is not valid.", code: "referral_not_found" };
  }

  if (inviter.telegramId === inviteeId) {
    return { error: "You cannot refer yourself.", code: "self_referral" };
  }

  let invitee = await User.findOne({ telegramId: inviteeId });
  if (!invitee) {
    invitee = new User({ telegramId: inviteeId });
  }

  if (profilePatch && typeof profilePatch === "object") {
    const keys = ["firstName", "lastName", "username", "languageCode", "isPremium", "photoUrl"];
    for (const k of keys) {
      if (profilePatch[k] != null) invitee[k] = profilePatch[k];
    }
  }

  if (invitee.invitedBy) {
    if (invitee.invitedBy === inviter.telegramId) {
      return {
        ok: true,
        alreadyClaimed: true,
        message: "Referral already applied.",
        inviterTelegramId: inviter.telegramId,
      };
    }
    return { error: "You already used a referral code.", code: "already_referred" };
  }

  const alreadyListed = (inviter.referredUsers || []).some((r) => r.telegramId === inviteeId);
  if (alreadyListed) {
    invitee.invitedBy = inviter.telegramId;
    await invitee.save();
    return {
      ok: true,
      alreadyClaimed: true,
      message: "Referral already recorded.",
      inviterTelegramId: inviter.telegramId,
    };
  }

  invitee.invitedBy = inviter.telegramId;
  invitee.shards = Math.max(0, Number(invitee.shards) || 0) + INVITEE_SHARD_REWARD;
  invitee.xp = Math.max(0, Number(invitee.xp) || 0) + INVITEE_XP_REWARD;
  invitee.level = levelFromXp(invitee.xp);

  inviter.shards = Math.max(0, Number(inviter.shards) || 0) + INVITER_SHARD_REWARD;
  inviter.xp = Math.max(0, Number(inviter.xp) || 0) + INVITER_XP_REWARD;
  inviter.level = levelFromXp(inviter.xp);
  inviter.referralCount = Math.max(0, Number(inviter.referralCount) || 0) + 1;
  inviter.referralRewardsEarned =
    Math.max(0, Number(inviter.referralRewardsEarned) || 0) + INVITER_SHARD_REWARD;
  if (!Array.isArray(inviter.referredUsers)) inviter.referredUsers = [];
  inviter.referredUsers.push({ telegramId: inviteeId, joinedAt: new Date() });

  await invitee.save();
  await inviter.save();

  console.log("[mining] referral claim", {
    inviteeId,
    inviterId: inviter.telegramId,
    referralCode: code,
    inviterShards: inviter.shards,
    inviteeShards: invitee.shards,
  });

  return {
    ok: true,
    alreadyClaimed: false,
    inviterTelegramId: inviter.telegramId,
    inviteeReward: { shards: INVITEE_SHARD_REWARD, xp: INVITEE_XP_REWARD },
    inviterReward: { shards: INVITER_SHARD_REWARD, xp: INVITER_XP_REWARD },
  };
}
