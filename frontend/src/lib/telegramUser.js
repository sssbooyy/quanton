export function getTelegramUser() {
  try {
    return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null;
  } catch {
    return null;
  }
}

const DEMO_TELEGRAM_ID_KEY = "quanton_demo_telegram_user_id";
const LEGACY_DEMO_KEY = "quanton_demo_telegram_id";

export function isTelegramMiniApp() {
  try {
    return Boolean(window.Telegram?.WebApp?.initData || window.Telegram?.WebApp?.initDataUnsafe?.user?.id);
  } catch {
    return false;
  }
}

/** Stable id for mining API (Telegram user id, or persisted browser demo id). */
export function getTelegramUserIdForMining() {
  const tg = getTelegramUser();
  if (tg?.id) {
    const id = String(tg.id).trim();
    try {
      window.localStorage.setItem(DEMO_TELEGRAM_ID_KEY, id);
    } catch {
      /* ignore */
    }
    return id;
  }
  try {
    let demo = window.localStorage.getItem(DEMO_TELEGRAM_ID_KEY);
    if (!demo) {
      demo = window.localStorage.getItem(LEGACY_DEMO_KEY);
      if (demo) window.localStorage.setItem(DEMO_TELEGRAM_ID_KEY, demo);
    }
    if (!demo) {
      demo = `demo_${Date.now().toString(36)}`;
      window.localStorage.setItem(DEMO_TELEGRAM_ID_KEY, demo);
      console.log("[mining] created persistent demo telegram id", { demo });
    }
    return demo;
  } catch {
    console.warn("[mining] localStorage unavailable; using in-memory demo id for session");
    if (!getTelegramUserIdForMining._sessionDemo) {
      getTelegramUserIdForMining._sessionDemo = `demo_${Date.now().toString(36)}`;
    }
    return getTelegramUserIdForMining._sessionDemo;
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
