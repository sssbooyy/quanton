export function getTelegramUser() {
  try {
    return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null;
  } catch {
    return null;
  }
}

export function isTelegramMiniApp() {
  try {
    return Boolean(window.Telegram?.WebApp?.initData || window.Telegram?.WebApp?.initDataUnsafe?.user?.id);
  } catch {
    return false;
  }
}

export function hapticImpact(style = "light") {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(style);
  } catch {
    /* ignore */
  }
}

export function hapticNotification(type = "success") {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(type);
  } catch {
    /* ignore */
  }
}

/** Open a gift / Telegram URL in Mini App or fall back to browser navigation. */
export function openExternalGiftLink(url) {
  const link = String(url ?? "").trim();
  if (!link) return false;
  try {
    const tg = window.Telegram?.WebApp;
    if (!tg?.initData && !tg?.initDataUnsafe?.user?.id) return false;
    if (/^https?:\/\/(t\.me|telegram\.me)\//i.test(link) && typeof tg.openTelegramLink === "function") {
      tg.openTelegramLink(link);
      return true;
    }
    if (typeof tg.openLink === "function") {
      tg.openLink(link);
      return true;
    }
  } catch {
    /* fall through to browser */
  }
  return false;
}
