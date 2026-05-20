/** Referral rewards and bot link config (off-chain shards only). */

export const REFERRAL_CODE_PREFIX = "ref_";
export const REFERRAL_CODE_LENGTH = 6;
export const REFERRAL_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const INVITER_SHARD_REWARD = 500;
export const INVITER_XP_REWARD = 250;
export const INVITEE_SHARD_REWARD = 250;
export const INVITEE_XP_REWARD = 100;

export function getTelegramBotUsername() {
  return (
    process.env.TELEGRAM_BOT_USERNAME?.trim() ||
    process.env.QUANTON_BOT_USERNAME?.trim() ||
    "QUANTON_BOT"
  );
}

export function buildReferralDeepLink(referralCode) {
  const bot = getTelegramBotUsername().replace(/^@/, "");
  const code = String(referralCode || "").trim().toUpperCase();
  return `https://t.me/${bot}?start=${REFERRAL_CODE_PREFIX}${code}`;
}

export function buildTelegramShareUrl(referralLink, text) {
  const url = encodeURIComponent(referralLink);
  const shareText = encodeURIComponent(text || "Join me on Quanton Mining!");
  return `https://t.me/share/url?url=${url}&text=${shareText}`;
}

/** Demo / browser test ids must not earn or trigger referral rewards. */
export function isDemoTelegramId(telegramId) {
  const id = String(telegramId || "").trim();
  return !id || id.startsWith("demo_") || id.startsWith("persist_test_");
}

export function normalizeReferralCode(input) {
  let s = String(input || "").trim().toUpperCase();
  if (s.startsWith("REF_")) s = s.slice(4);
  if (s.startsWith(REFERRAL_CODE_PREFIX.toUpperCase())) s = s.slice(REFERRAL_CODE_PREFIX.length);
  return s.replace(/[^A-Z0-9]/g, "").slice(0, 16);
}

export function parseStartParamReferralCode(startParam) {
  const raw = String(startParam || "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  if (lower.startsWith(REFERRAL_CODE_PREFIX)) {
    return normalizeReferralCode(raw.slice(REFERRAL_CODE_PREFIX.length));
  }
  if (/^[A-Z0-9]{4,16}$/i.test(raw)) return normalizeReferralCode(raw);
  return "";
}
