/** @typedef {"en" | "ru"} Lang */

export const LANG_STORAGE_KEY = "quanton_market_lang";

export const translations = {
  en: {
    livePill: "Live",
    restBadge: "REST",
    brandTagline: "AI MARKETPLACE",
    langEn: "EN",
    langRu: "RU",
    langSwitcherAria: "Interface language",

    liveMarketPill: "Quanton Live",
    liveMarketTitle: "TON gift desk — model-ranked tape",
    liveMarketSub:
      "Live filters, floor versus ask, model score, and tape-style liquidity for the TON gift ecosystem.",
    tickerTitle: "Top model score",
    tickerHint: "this session",
    tickerEdge: "edge",

    heroEyebrow: "Quanton market",
    heroTitle: "Trade faster. Move in TON.",
    heroSubtitle:
      "Quanton Market is a Telegram-native terminal for gift listings: model score, discount versus reference floor, tape volume, and risk tags — one screen, one language.",

    metricsOverviewAria: "Session overview",
    metricOpenListings: "Open listings",
    metricAvgScore: "Avg model score",
    metricStrongTape: "Strong buy tape",
    metricFloorGap: "Floor gap 15%+",
    metric24hPrints: "24h prints (sum)",

    tabFilterAria: "Listing filters",
    tabAll: "All listings",
    tabFloorDiscount: "Floor discount",
    tabHighScore: "High score",
    addListing: "List your gift",
    testDeskAlert: "Test desk alert",

    loadingText: "Syncing market data...",
    emptyFilter: "No listings match the selected filter.",

    closeDialogAria: "Close dialog",
    modalKicker: "Quanton listing",
    modalTitle: "List your gift",
    modalBody:
      "Paste a Telegram gift link or gift ID and your ask in TON. We will detect image, rarity and metadata automatically.",
    ariaCloseModal: "Close",
    formGiftLink: "Paste Telegram gift link",
    phGiftLink: "e.g. t.me/… or gift_starter_001",
    hintGiftResolver: "We will detect image, rarity and metadata automatically.",
    formPriceTon: "Your price (TON)",
    formSellerNote: "Seller note (optional)",
    phSellerNote: "Optional context for buyers",
    cancelBtn: "Cancel",
    submitListing: "List gift",
    submittingLabel: "Listing…",

    errGiftLinkRequired: "Paste a Telegram gift link or gift ID.",
    errPricePositive: "Price in TON must be a number greater than 0.",
    successToastSubmit:
      "Gift listed on Quanton Market. Status is pending until cleared.",
    errSubmitGeneric: "Could not submit listing.",

    alertLoadFailed: "Could not sync listings. Check your connection and API URL.",
    alertTestOk: "Test alert sent to your admin Telegram chat.",
    alertTestFail: "Failed to send alert",

    badgeScoreTitle: "Model score",
    badgeScoreLabel: "Score",
    edgeTitle: "Discount versus reference floor",
    edgeSuffix: "edge",
    fieldAsk: "Ask",
    fieldRefFloor: "Ref. floor",
    fieldDepth: "Depth",
    depthBarTitle: "Depth versus floor",
    metaRarity: "Rarity",
    meta24h: "24h",
    metaVol: "Vol",
    tagLiqHigh: "High liq",
    tagLiqMedium: "Medium liq",
    tagLiqLow: "Low liq",
    tagLiqUnknown: "Unknown liq",
    tagRiskLow: "Low risk",
    tagRiskMedium: "Medium risk",
    tagRiskHigh: "High risk",
    tagRiskUnknown: "Unknown risk",
    giftPlaceholder: "Gift",
    fallbackBrand: "Quanton",

    signalStrongBuy: "Strong Buy",
    signalWatch: "Watch",
    signalRisky: "Risky",
    signalNeutral: "Neutral",
    statusApproved: "approved",
    statusPending: "pending",
  },

  ru: {
    livePill: "Онлайн",
    restBadge: "REST",
    brandTagline: "ИИ‑РЫНОК",
    langEn: "EN",
    langRu: "RU",
    langSwitcherAria: "Язык интерфейса",

    liveMarketPill: "Quanton Live",
    liveMarketTitle: "TON‑стол подарков — лента по модели",
    liveMarketSub:
      "Живые фильтры, флор и аск, скор модели и ликвидность ленты в экосистеме TON‑подарков.",
    tickerTitle: "Топ по скору модели",
    tickerHint: "сессия",
    tickerEdge: "к флору",

    heroEyebrow: "Рынок Quanton",
    heroTitle: "Быстрее сделки. Движение в TON.",
    heroSubtitle:
      "Quanton Market — нативный для Telegram терминал по лотам подарков: скор модели, дисконт к референс‑флору, объём ленты и теги риска — один экран, один язык интерфейса.",

    metricsOverviewAria: "Сводка сессии",
    metricOpenListings: "Открытые лоты",
    metricAvgScore: "Средний скор модели",
    metricStrongTape: "Сильный buy по ленте",
    metricFloorGap: "Разрыв к флору 15%+",
    metric24hPrints: "Принты 24ч (сумма)",

    tabFilterAria: "Фильтры лотов",
    tabAll: "Все лоты",
    tabFloorDiscount: "Дисконт к флору",
    tabHighScore: "Высокий скор",
    addListing: "Выложить подарок",
    testDeskAlert: "Тестовый алерт",

    loadingText: "Синхронизация рыночных данных...",
    emptyFilter: "Нет лотов под выбранный фильтр.",

    closeDialogAria: "Закрыть окно",
    modalKicker: "Лот Quanton",
    modalTitle: "Выложить подарок",
    modalBody:
      "Вставьте ссылку на подарок Telegram или ID и цену в TON. Изображение, редкость и метаданные подтянем автоматически.",
    ariaCloseModal: "Закрыть",
    formGiftLink: "Ссылка на подарок Telegram",
    phGiftLink: "напр. t.me/… или gift_starter_001",
    hintGiftResolver: "Изображение, редкость и метаданные определим автоматически.",
    formPriceTon: "Ваша цена (TON)",
    formSellerNote: "Заметка продавца (необязательно)",
    phSellerNote: "Контекст для покупателей — по желанию",
    cancelBtn: "Отмена",
    submitListing: "Выложить",
    submittingLabel: "Публикация…",

    errGiftLinkRequired: "Вставьте ссылку на подарок или ID.",
    errPricePositive: "Цена в TON должна быть числом больше 0.",
    successToastSubmit:
      "Лот опубликован в Quanton Market. Статус pending до проверки.",
    errSubmitGeneric: "Не удалось отправить лот.",

    alertLoadFailed: "Не удалось загрузить ленту. Проверьте сеть и URL API.",
    alertTestOk: "Тестовый алерт отправлен в Telegram администратору.",
    alertTestFail: "Не удалось отправить алерт",

    badgeScoreTitle: "Скор модели",
    badgeScoreLabel: "Скор",
    edgeTitle: "Дисконт к референс‑флору",
    edgeSuffix: "к флору",
    fieldAsk: "Аск",
    fieldRefFloor: "Реф. флор",
    fieldDepth: "Глубина",
    depthBarTitle: "Глубина к флору",
    metaRarity: "Редкость",
    meta24h: "24ч",
    metaVol: "Объём",
    tagLiqHigh: "Высокая ликв.",
    tagLiqMedium: "Средняя ликв.",
    tagLiqLow: "Низкая ликв.",
    tagLiqUnknown: "Ликв. неизв.",
    tagRiskLow: "Низкий риск",
    tagRiskMedium: "Средний риск",
    tagRiskHigh: "Высокий риск",
    tagRiskUnknown: "Риск неизв.",
    giftPlaceholder: "Лот",
    fallbackBrand: "Quanton",

    signalStrongBuy: "Сильная покупка",
    signalWatch: "Наблюдение",
    signalRisky: "Рискованно",
    signalNeutral: "Нейтрально",
    statusApproved: "одобрено",
    statusPending: "ожидает",
  },
};

/** @returns {Lang} */
export function getInitialLanguage() {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === "en" || stored === "ru") return stored;
  } catch {
    /* ignore */
  }
  try {
    const code = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
    if (code && String(code).toLowerCase().startsWith("ru")) return "ru";
  } catch {
    /* ignore */
  }
  return "en";
}

/**
 * @param {Lang} lang
 * @param {string} key
 */
export function t(lang, key) {
  const pack = translations[lang] || translations.en;
  const v = pack[key];
  if (v !== undefined) return v;
  return translations.en[key] ?? key;
}

/**
 * @param {Lang} lang
 * @param {string} signal
 */
export function translateSignal(lang, signal) {
  if (lang !== "ru") return signal;
  const map = {
    "Strong Buy": translations.ru.signalStrongBuy,
    Watch: translations.ru.signalWatch,
    Risky: translations.ru.signalRisky,
    Neutral: translations.ru.signalNeutral,
  };
  return map[signal] ?? signal;
}

/**
 * @param {Lang} lang
 * @param {string | undefined | null} status
 */
export function translateStatus(lang, status) {
  if (!status) return "";
  if (lang !== "ru") return status;
  if (status === "approved") return translations.ru.statusApproved;
  if (status === "pending") return translations.ru.statusPending;
  return status;
}

/**
 * @param {Lang} lang
 * @param {string} tier
 * @param {"liq" | "risk"} kind
 */
export function translateLiquidityRisk(lang, tier, kind) {
  const T = tier || "Unknown";
  if (lang !== "ru") {
    if (kind === "liq") return `${T} liq`;
    return `${T} risk`;
  }
  const liq = {
    High: translations.ru.tagLiqHigh,
    Medium: translations.ru.tagLiqMedium,
    Low: translations.ru.tagLiqLow,
    Unknown: translations.ru.tagLiqUnknown,
  };
  const risk = {
    Low: translations.ru.tagRiskLow,
    Medium: translations.ru.tagRiskMedium,
    High: translations.ru.tagRiskHigh,
    Unknown: translations.ru.tagRiskUnknown,
  };
  if (kind === "liq") return liq[T] ?? translations.ru.tagLiqUnknown;
  return risk[T] ?? translations.ru.tagRiskUnknown;
}

/** Server / client error strings → Russian copy */
const SERVER_ERR_RU = {
  "Gift link or gift ID is required.": "Вставьте ссылку на подарок или ID.",
  "Could not resolve gift metadata (missing title or image).":
    "Не удалось получить название или изображение подарка.",
  "Could not resolve gift metadata.": "Не удалось разобрать метаданные подарка.",
  "Gift name is required.": "Укажите название лота.",
  "Collection is required.": "Укажите коллекцию.",
  "Image URL is required.": "Нужен URL изображения.",
  "Price in TON must be a number greater than 0.":
    "Цена в TON должна быть числом больше 0.",
  "Floor price in TON must be a number greater than 0.":
    "Флор в TON должен быть числом больше 0.",
  "Rarity must be a whole number from 1 to 100.":
    "Редкость — целое число от 1 до 100.",
  "No listings on file. Add a listing before sending a test alert.":
    "Нет лотов в базе. Добавьте лот перед тестовым алертом.",
};

/**
 * @param {Lang} lang
 * @param {string} message
 */
export function translateServerMessage(lang, message) {
  if (lang !== "ru" || typeof message !== "string") return message;
  return SERVER_ERR_RU[message] ?? message;
}

/**
 * @param {Lang} lang
 * @param {{ name: string; signal: string; undervaluedPercent?: number }} gift
 */
export function deskNote(lang, gift) {
  if (lang === "en") return gift.explanation;
  const n = gift.name;
  const g = Math.round(Number(gift.undervaluedPercent) || 0);
  switch (gift.signal) {
    case "Strong Buy":
      return `Биржевой скан Quanton: ${n} — модель видит ~${g}% к справочному флору; редкость и потоки на стороне покупателя.`;
    case "Watch":
      return `Quanton: ${n} в зоне наблюдения — проверьте ликвидность и 24ч принты перед объёмом.`;
    case "Risky":
      return `Quanton: ${n} читается рискованно — соотношение риск/доходность не в вашу пользу на текущей ленте.`;
    case "Neutral":
      return `Quanton: ${n} без явного перевеса — ждите подтверждения по ленте или пропускайте.`;
    default:
      return gift.explanation;
  }
}
