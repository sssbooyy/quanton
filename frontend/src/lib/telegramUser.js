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
