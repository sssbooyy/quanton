/**
 * Resolve Telegram user id for Mini App API calls.
 * Prefer header X-Telegram-User-Id, then body.telegramUser.id, then body.telegramId.
 */
export function resolveTelegramUserId(req) {
  const header = String(req.headers["x-telegram-user-id"] ?? "").trim();
  if (header) return header;
  const fromBody = req.body?.telegramUser || req.body?.user || {};
  if (fromBody?.id) return String(fromBody.id).trim();
  return String(req.body?.telegramId ?? req.query?.telegramId ?? "").trim();
}

export function resolveTelegramProfilePatch(req) {
  const fromBody = req.body?.telegramUser || req.body?.user || {};
  if (!fromBody?.id) return {};
  return {
    firstName: String(fromBody.first_name || fromBody.firstName || "").trim(),
    lastName: String(fromBody.last_name || fromBody.lastName || "").trim(),
    username: String(fromBody.username || "").trim(),
    languageCode: String(fromBody.language_code || fromBody.languageCode || "").trim(),
    isPremium: Boolean(fromBody.is_premium ?? fromBody.isPremium),
    photoUrl: String(fromBody.photo_url || fromBody.photoUrl || "").trim(),
  };
}

export function requireTelegramUser(req, res, next) {
  const telegramId = resolveTelegramUserId(req);
  if (!telegramId) {
    return res.status(400).json({
      error: "Telegram user id is required. Open the app inside Telegram or pass x-telegram-user-id.",
      code: "TELEGRAM_USER_REQUIRED",
    });
  }
  req.telegramUserId = telegramId;
  req.telegramProfilePatch = resolveTelegramProfilePatch(req);
  return next();
}
