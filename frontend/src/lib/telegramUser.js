export function getTelegramUser() {
  try {
    return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null;
  } catch {
    return null;
  }
}

/** Stable id for mining API (Telegram user or dev demo id). */
export function getTelegramUserIdForMining() {
  const tg = getTelegramUser();
  if (tg?.id) return String(tg.id);
  try {
    const key = "quanton_demo_telegram_id";
    let demo = window.localStorage.getItem(key);
    if (!demo) {
      demo = `demo_${Date.now().toString(36)}`;
      window.localStorage.setItem(key, demo);
    }
    return demo;
  } catch {
    return "demo_local";
  }
}

export function miningAuthHeaders() {
  const id = getTelegramUserIdForMining();
  const tg = getTelegramUser();
  return {
    "X-Telegram-User-Id": id,
    ...(tg ? { "X-Telegram-User-Json": JSON.stringify(tg) } : {}),
  };
}

export function miningAuthBody(extra = {}) {
  const tg = getTelegramUser();
  return {
    telegramId: getTelegramUserIdForMining(),
    ...(tg ? { telegramUser: tg } : {}),
    ...extra,
  };
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
