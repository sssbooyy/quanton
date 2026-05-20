const PENDING_REF_KEY = "quanton_pending_referral_code";

export function parseReferralCodeFromStartParam(startParam) {
  const raw = String(startParam || "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  if (lower.startsWith("ref_")) {
    return raw.slice(4).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  }
  if (/^[A-Za-z0-9]{4,16}$/.test(raw)) return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return "";
}

export function getTelegramStartParam() {
  try {
    return (
      window.Telegram?.WebApp?.initDataUnsafe?.start_param ||
      new URLSearchParams(window.location.search).get("tgWebAppStartParam") ||
      ""
    );
  } catch {
    return "";
  }
}

export function consumePendingReferralCode() {
  try {
    const fromUrl = parseReferralCodeFromStartParam(getTelegramStartParam());
    if (fromUrl) {
      window.localStorage.setItem(PENDING_REF_KEY, fromUrl);
      return fromUrl;
    }
    const stored = window.localStorage.getItem(PENDING_REF_KEY);
    return stored ? String(stored).trim().toUpperCase() : "";
  } catch {
    return parseReferralCodeFromStartParam(getTelegramStartParam());
  }
}

export function clearPendingReferralCode() {
  try {
    window.localStorage.removeItem(PENDING_REF_KEY);
  } catch {
    /* ignore */
  }
}
