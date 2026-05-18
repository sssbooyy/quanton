/** @typedef {"en" | "ru"} Lang */

export const LANG_STORAGE_KEY = "quanton_market_lang";

export const translations = {
  en: {
    livePill: "Live",
    feedTagline: "Telegram gift marketplace",
    tickerAria: "Top listings by score",

    langEn: "EN",
    langRu: "RU",
    langSwitcherAria: "Interface language",

    statListings: "listings",
    statAvg: "avg",
    statStrong: "strong",
    statGap: "15%+",
    statPrints: "24h Σ",

    metricsOverviewAria: "Market snapshot",

    tabFilterAria: "Filters",
    tabAll: "All",
    tabFloorDiscount: "−15%",
    tabHighScore: "Score 80+",
    addListing: "List",
    escrowOnboardingTitle: "Sell with Telegram escrow",
    escrowOnboardingBody: "Send the actual gift to Quanton bot. After escrow verification, set your TON price in Telegram.",
    escrowSendGift: "Send gift to Quanton bot",
    manualListingFallback: "Manual listing",
    testDeskAlert: "Test alert",

    loadingText: "Loading…",
    emptyFilter: "Nothing matches this filter.",

    closeDialogAria: "Close dialog",
    modalKicker: "New listing",
    modalTitle: "List a gift",
    modalBody: "Telegram gift link or ID, price in TON.",
    ariaCloseModal: "Close",
    formGiftLink: "Gift link or ID",
    phGiftLink: "t.me/… or gift id",
    hintGiftResolver: "Metadata resolves automatically.",
    formPriceTon: "Your price (TON)",
    formSellerNote: "Seller note (optional)",
    phSellerNote: "Optional context for buyers",
    cancelBtn: "Cancel",
    submitListing: "List gift",
    submittingLabel: "Listing…",

    errGiftLinkRequired: "Paste a Telegram gift link or gift ID.",
    errPricePositive: "Price in TON must be a number greater than 0.",
    successToastSubmit: "Listed. Pending until cleared.",
    errSubmitGeneric: "Could not submit listing.",

    alertLoadFailed: "Could not sync listings. Check your connection and API URL.",
    alertTestOk: "Test alert sent to your admin Telegram chat.",
    alertTestFail: "Failed to send alert",

    badgeScoreTitle: "Model score",
    badgeScoreLabel: "Score",
    animHintTitle: "Animated gift — open details for preview",
    animHintShort: "LIVE",
    badgeUpscalingTitle: "Sharpening image on server…",
    badgeUpscalingShort: "HQ",
    badgeUpscalingDetail: "Enhancing…",
    badgeEnhancedTitle: "AI-upscaled preview (server-side)",
    badgeEnhancedShort: "HD",
    edgeTitle: "vs ref. floor",
    edgeSuffix: "edge",
    fieldAsk: "Ask",
    fieldRefFloor: "Ref. floor",
    detailLiveFloor: "Live floor",
    detailFloorLiveHint: "Quote from live marketplace data",
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
    statusPending: "Pending",
    statusLive: "Live",
    statusSold: "Sold",
    statusReserved: "Reserved",
    statusTransferred: "Transferred",

    searchPlaceholder: "Search name, collection, model, #…",
    filterPanelTitle: "Filters & sort",
    filterPriceMin: "Min TON",
    filterPriceMax: "Max TON",
    filterCollection: "Collection",
    filterCollectionAll: "All collections",
    filterMinRarity: "Min rarity",
    filterMinScore: "Min score",
    filterStatusAll: "All",
    filterStatusLive: "Live",
    filterStatusPending: "Pending",
    filterStatusSold: "Sold",
    filterListingStatusGroup: "Status",
    sortLabel: "Sort",
    sortNewest: "Newest",
    sortPriceLow: "Price ↑",
    sortPriceHigh: "Price ↓",
    sortScore: "Score",
    sortFloorDiff: "Floor gap",
    presetAll: "All",
    presetDiscount: "−15% floor",
    presetHighScore: "Score 80+",
    filtersReset: "Reset",

    cartAria: "Cart",
    cartTitle: "Cart",
    cartEmpty: "No items yet.",
    cartTotal: "Total",
    cartClear: "Clear",
    cartRemove: "Remove",
    cartCheckout: "Checkout",
    addToCart: "Add to cart",
    inCart: "In cart",

    portalsMarketplace: "Quanton Marketplace",
    floorDeltaBelow: "{pct}% below floor",
    floorDeltaAbove: "{pct}% above floor",
    floorDeltaAtFloor: "At floor",
    portalsFloorTitle: "Floor price",
    portalsMakeOffer: "Make an offer",
    portalsOfferHint: "from 0.01 TON",
    portalsAttributes: "Attributes",
    attrModel: "Model",
    attrSymbol: "Symbol",
    attrBackdrop: "Background",
    portalsPriceCompare: "Price",
    portalsSellerPrice: "Seller price",
    portalsReferenceFloor: "Floor price",
    portalsTrustFooter: "Secure · On-chain · Transparent",

    detailSheetKicker: "Listing",
    detailGiftId: "ID",
    detailSectionMarket: "Market",
    detailSectionTape: "Market",
    detailSectionSignals: "Signals",
    detailSectionNarrative: "Notes",
    detailSectionContext: "Notes",
    detailVolatility: "Volume trend",
    detailHistory: "Session prints",
    detailSellerNote: "Seller note",
    detailGiftLink: "Gift link",
    detailOpenListing: "Open listing",

    collectibleMenuAria: "Menu",
    collectibleCloseAria: "Close",
  },

  ru: {
    livePill: "Онлайн",
    feedTagline: "Маркетплейс подарков Telegram",
    tickerAria: "Топ лотов по скору",

    langEn: "EN",
    langRu: "RU",
    langSwitcherAria: "Язык интерфейса",

    statListings: "лотов",
    statAvg: "ср.",
    statStrong: "сильн.",
    statGap: "15%+",
    statPrints: "24ч Σ",

    metricsOverviewAria: "Сводка рынка",

    tabFilterAria: "Фильтры",
    tabAll: "Все",
    tabFloorDiscount: "−15%",
    tabHighScore: "Скор 80+",
    addListing: "Лот",
    escrowOnboardingTitle: "Продажа через Telegram escrow",
    escrowOnboardingBody: "Отправьте настоящий подарок боту Quanton. После проверки escrow задайте цену в TON в Telegram.",
    escrowSendGift: "Отправить подарок боту",
    manualListingFallback: "Ручной лот",
    testDeskAlert: "Тест",

    loadingText: "Загрузка…",
    emptyFilter: "Нет лотов по фильтру.",

    closeDialogAria: "Закрыть окно",
    modalKicker: "Новый лот",
    modalTitle: "Выложить подарок",
    modalBody: "Ссылка или ID подарка, цена в TON.",
    ariaCloseModal: "Закрыть",
    formGiftLink: "Ссылка или ID",
    phGiftLink: "t.me/… или id",
    hintGiftResolver: "Метаданные подтянем сами.",
    formPriceTon: "Ваша цена (TON)",
    formSellerNote: "Заметка продавца (необязательно)",
    phSellerNote: "Контекст для покупателей — по желанию",
    cancelBtn: "Отмена",
    submitListing: "Выложить",
    submittingLabel: "Публикация…",

    errGiftLinkRequired: "Вставьте ссылку на подарок или ID.",
    errPricePositive: "Цена в TON должна быть числом больше 0.",
    successToastSubmit: "Опубликовано. Статус pending до проверки.",
    errSubmitGeneric: "Не удалось отправить лот.",

    alertLoadFailed: "Не удалось загрузить ленту. Проверьте сеть и URL API.",
    alertTestOk: "Тестовый алерт отправлен в Telegram администратору.",
    alertTestFail: "Не удалось отправить алерт",

    badgeScoreTitle: "Скор модели",
    badgeScoreLabel: "Скор",
    animHintTitle: "Анимированный подарок — откройте карточку для превью",
    animHintShort: "LIVE",
    badgeUpscalingTitle: "Улучшение изображения на сервере…",
    badgeUpscalingShort: "HQ",
    badgeUpscalingDetail: "Улучшение…",
    badgeEnhancedTitle: "Превью с AI‑апскейлом (на сервере)",
    badgeEnhancedShort: "HD",
    edgeTitle: "к реф. флору",
    edgeSuffix: "к флору",
    fieldAsk: "Аск",
    fieldRefFloor: "Реф. флор",
    detailLiveFloor: "Лайв‑флор",
    detailFloorLiveHint: "Котировка с живых данных маркетплейса",
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
    statusLive: "В продаже",
    statusSold: "Продано",
    statusReserved: "Зарезервировано",
    statusTransferred: "Передано",

    searchPlaceholder: "Поиск: имя, коллекция, модель, #…",
    filterPanelTitle: "Фильтры и сортировка",
    filterPriceMin: "Мин. TON",
    filterPriceMax: "Макс. TON",
    filterCollection: "Коллекция",
    filterCollectionAll: "Все коллекции",
    filterMinRarity: "Мин. редкость",
    filterMinScore: "Мин. скор",
    filterStatusAll: "Все",
    filterStatusLive: "В продаже",
    filterStatusPending: "Ожидает",
    filterStatusSold: "Продано",
    filterListingStatusGroup: "Статус",
    sortLabel: "Сортировка",
    sortNewest: "Новые",
    sortPriceLow: "Цена ↑",
    sortPriceHigh: "Цена ↓",
    sortScore: "Скор",
    sortFloorDiff: "К флору",
    presetAll: "Все",
    presetDiscount: "−15% к флору",
    presetHighScore: "Скор 80+",
    filtersReset: "Сброс",

    cartAria: "Корзина",
    cartTitle: "Корзина",
    cartEmpty: "Пока пусто.",
    cartTotal: "Итого",
    cartClear: "Очистить",
    cartRemove: "Убрать",
    cartCheckout: "Оформление",
    addToCart: "В корзину",
    inCart: "В корзине",

    portalsMarketplace: "Quanton Маркет",
    floorDeltaBelow: "На {pct}% ниже флора",
    floorDeltaAbove: "На {pct}% выше флора",
    floorDeltaAtFloor: "У флора",
    portalsFloorTitle: "Флор",
    portalsMakeOffer: "Предложить цену",
    portalsOfferHint: "от 0.01 TON",
    portalsAttributes: "Атрибуты",
    attrModel: "Модель",
    attrSymbol: "Символ",
    attrBackdrop: "Фон",
    portalsPriceCompare: "Цена",
    portalsSellerPrice: "Цена продавца",
    portalsReferenceFloor: "Флор",
    portalsTrustFooter: "Безопасно · On-chain · Прозрачно",

    detailSheetKicker: "Лот",
    detailGiftId: "ID",
    detailSectionMarket: "Рынок",
    detailSectionTape: "Рынок",
    detailSectionSignals: "Сигналы",
    detailSectionNarrative: "Заметка",
    detailSectionContext: "Заметка",
    detailVolatility: "Динамика объёма",
    detailHistory: "Принты сессии",
    detailSellerNote: "Заметка продавца",
    detailGiftLink: "Ссылка на подарок",
    detailOpenListing: "Лот на рынке",

    collectibleMenuAria: "Меню",
    collectibleCloseAria: "Закрыть",
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
 * User-facing listing status (approved → Live).
 * @param {Lang} lang
 * @param {string | undefined | null} status
 */
export function listingStatusLabel(lang, status) {
  const s = String(status ?? "")
    .trim()
    .toLowerCase();
  if (s === "approved") return lang === "ru" ? translations.ru.statusLive : translations.en.statusLive;
  if (s === "pending")
    return lang === "ru" ? translations.ru.statusPending : translations.en.statusPending;
  if (s === "reserved") return lang === "ru" ? translations.ru.statusReserved : translations.en.statusReserved;
  if (s === "sold") return lang === "ru" ? translations.ru.statusSold : translations.en.statusSold;
  if (s === "transferred")
    return lang === "ru" ? translations.ru.statusTransferred : translations.en.statusTransferred;
  if (!status) return "";
  return translateStatus(lang, status);
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
