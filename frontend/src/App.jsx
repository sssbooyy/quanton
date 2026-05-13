import { useEffect, useMemo, useState } from "react";
import { addGift, getGifts, sendTestAlert } from "./api";
import {
  LANG_STORAGE_KEY,
  deskNote,
  getInitialLanguage,
  t,
  translateLiquidityRisk,
  translateServerMessage,
  translateSignal,
  translateStatus,
  translations,
} from "./translations";

const emptyGiftForm = {
  name: "",
  collection: "",
  image: "",
  priceTon: "",
  floorTon: "",
  rarity: "",
};

function getTelegramUser() {
  try {
    return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null;
  } catch {
    return null;
  }
}

function signalClass(signal) {
  if (signal === "Strong Buy") return "signal-bull";
  if (signal === "Watch") return "signal-watch";
  if (signal === "Risky") return "signal-risk";
  return "signal-neutral";
}

function formatSignedPct(n) {
  if (n > 0) return `+${n}%`;
  return `${n}%`;
}

function statusBadgeClass(status) {
  if (status === "pending") return "badgeStatus badgeStatus-pending";
  if (status === "approved") return "badgeStatus badgeStatus-approved";
  return "badgeStatus";
}

export default function App() {
  const [lang, setLang] = useState(getInitialLanguage);
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  const [giftForm, setGiftForm] = useState(emptyGiftForm);
  const [giftSubmitting, setGiftSubmitting] = useState(false);
  const [giftFormError, setGiftFormError] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  const tk = useMemo(() => (key) => t(lang, key), [lang]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
    loadGifts({ showSpinner: true });
  }, []);

  useEffect(() => {
    if (!giftModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [giftModalOpen]);

  useEffect(() => {
    if (!giftModalOpen) return;
    function onKey(e) {
      if (e.key === "Escape") {
        setGiftModalOpen(false);
        setGiftFormError(null);
        setGiftForm(emptyGiftForm);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [giftModalOpen]);

  useEffect(() => {
    if (!successToast) return;
    const timer = setTimeout(() => setSuccessToast(null), 4500);
    return () => clearTimeout(timer);
  }, [successToast]);

  function openGiftModal() {
    setGiftFormError(null);
    setGiftModalOpen(true);
  }

  function closeGiftModal() {
    setGiftModalOpen(false);
    setGiftFormError(null);
    setGiftForm(emptyGiftForm);
  }

  async function loadGifts(options = { showSpinner: true }) {
    const { showSpinner } = options;
    try {
      if (showSpinner) setLoading(true);
      const data = await getGifts();
      setGifts(data);
    } catch (error) {
      console.error(error);
      alert(t(lang, "alertLoadFailed"));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  function updateGiftField(field, value) {
    setGiftForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleAddGift(e) {
    e.preventDefault();
    setGiftFormError(null);

    const nameTrim = giftForm.name.trim();
    const collectionTrim = giftForm.collection.trim();
    const imageTrim = giftForm.image.trim();
    const priceTon = Number(giftForm.priceTon);
    const floorTon = Number(giftForm.floorTon);
    const rarityNum = Number(giftForm.rarity);

    if (!nameTrim) {
      setGiftFormError(t(lang, "errNameRequired"));
      return;
    }
    if (!collectionTrim) {
      setGiftFormError(t(lang, "errCollectionRequired"));
      return;
    }
    if (!imageTrim) {
      setGiftFormError(t(lang, "errImageRequired"));
      return;
    }
    if (!Number.isFinite(priceTon) || priceTon <= 0) {
      setGiftFormError(t(lang, "errPricePositive"));
      return;
    }
    if (!Number.isFinite(floorTon) || floorTon <= 0) {
      setGiftFormError(t(lang, "errFloorPositive"));
      return;
    }
    if (!Number.isInteger(rarityNum) || rarityNum < 1 || rarityNum > 100) {
      setGiftFormError(t(lang, "errRarityInt"));
      return;
    }

    const payload = {
      name: nameTrim,
      collection: collectionTrim,
      image: imageTrim,
      priceTon,
      floorTon,
      rarity: rarityNum,
    };
    const tgUser = getTelegramUser();
    if (tgUser) {
      payload.telegramUser = tgUser;
    }

    try {
      setGiftSubmitting(true);
      await addGift(payload);
      setGiftForm(emptyGiftForm);
      setGiftModalOpen(false);
      setSuccessToast(t(lang, "successToastSubmit"));
      await loadGifts({ showSpinner: false });
    } catch (error) {
      console.error(error);
      const msg =
        error.response?.data?.error ||
        error.message ||
        t(lang, "errSubmitGeneric");
      const shown =
        typeof msg === "string" ? translateServerMessage(lang, msg) : t(lang, "errSubmitGeneric");
      setGiftFormError(shown);
    } finally {
      setGiftSubmitting(false);
    }
  }

  async function handleTestAlert() {
    try {
      await sendTestAlert();
      alert(t(lang, "alertTestOk"));
    } catch (error) {
      console.error(error);
      const msg =
        error.response?.data?.error ||
        error.message ||
        t(lang, "alertTestFail");
      alert(
        typeof msg === "string" ? translateServerMessage(lang, msg) : t(lang, "alertTestFail")
      );
    }
  }

  const filteredGifts = gifts.filter((gift) => {
    if (tab === "undervalued") return gift.undervaluedPercent >= 15;
    if (tab === "strong") return gift.aiScore >= 80;
    return true;
  });

  const aggregates = useMemo(() => {
    const strong = gifts.filter((g) => g.aiScore >= 80).length;
    const cheap = gifts.filter((g) => g.undervaluedPercent >= 15).length;
    const avgScore =
      gifts.length === 0
        ? 0
        : Math.round(gifts.reduce((a, g) => a + g.aiScore, 0) / gifts.length);
    const totalVol = gifts.reduce((a, g) => a + (g.sales24h || 0), 0);
    return { strong, cheap, avgScore, totalVol };
  }, [gifts]);

  const ticker = useMemo(() => {
    if (!gifts.length) return [];
    return [...gifts]
      .sort((a, b) => b.aiScore - a.aiScore)
      .slice(0, 5)
      .map((g, i) => ({
        id: g.id,
        rank: i + 1,
        label: g.name,
        score: g.aiScore,
        gap: g.undervaluedPercent,
        signal: g.signal,
      }));
  }, [gifts]);

  return (
    <div className="shell">
      {successToast && (
        <div className="successToast" role="status" aria-live="polite">
          {successToast}
        </div>
      )}

      <header className="topbar">
        <div className="brand">
          <span className="brandMark" aria-hidden="true" />
          <div className="brandLockup">
            <span className="brandQuanton">QUANTON</span>
            <span className="brandTagline">{translations[lang].brandTagline}</span>
          </div>
        </div>
        <div className="topbarRight">
          <div className="langToggle" role="group" aria-label={tk("langSwitcherAria")}>
            <button
              type="button"
              className={lang === "en" ? "active" : ""}
              aria-pressed={lang === "en"}
              onClick={() => setLang("en")}
            >
              {tk("langEn")}
            </button>
            <button
              type="button"
              className={lang === "ru" ? "active" : ""}
              aria-pressed={lang === "ru"}
              onClick={() => setLang("ru")}
            >
              {tk("langRu")}
            </button>
          </div>
          <span className="livePill">
            <span className="liveDot" aria-hidden="true" />
            {tk("livePill")}
          </span>
          <span className="mono muted">{tk("restBadge")}</span>
        </div>
      </header>

      <section className="liveMarketBand" aria-labelledby="live-market-heading">
        <div className="liveMarketHeader">
          <span className="liveMarketPill">{tk("liveMarketPill")}</span>
          <h2 id="live-market-heading" className="liveMarketTitle">
            {tk("liveMarketTitle")}
          </h2>
          <p className="liveMarketSub">{tk("liveMarketSub")}</p>
        </div>
        {ticker.length > 0 && (
          <div className="premiumTicker">
            <div className="premiumTickerHead">
              <span className="premiumTickerTitle">{tk("tickerTitle")}</span>
              <span className="mono premiumTickerHint">{tk("tickerHint")}</span>
            </div>
            <div className="premiumTickerScroll" role="list">
              {ticker.map((row) => (
                <div key={row.id} className="tickerChip" role="listitem">
                  <span className="tickerChipRank mono">#{row.rank}</span>
                  <span className="tickerChipName">{row.label}</span>
                  <span className="mono tickerChipScore">{row.score}</span>
                  <span
                    className={`mono tickerChipGap ${row.gap >= 15 ? "text-bull" : "text-muted"}`}
                  >
                    {formatSignedPct(row.gap)} {tk("tickerEdge")}
                  </span>
                  <span
                    className={`tickerChipDot ${signalClass(row.signal)}`}
                    title={translateSignal(lang, row.signal)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <main className="app">
        <section className="hero">
          <p className="eyebrow">{tk("heroEyebrow")}</p>
          <h1>{tk("heroTitle")}</h1>
          <p className="subtitle">{tk("heroSubtitle")}</p>
        </section>

        <section className="metricRibbon" aria-label={tk("metricsOverviewAria")}>
          <div className="metricCell">
            <span className="metricLabel">{tk("metricOpenListings")}</span>
            <span className="metricValue mono">{gifts.length}</span>
          </div>
          <div className="metricCell">
            <span className="metricLabel">{tk("metricAvgScore")}</span>
            <span className="metricValue mono">{aggregates.avgScore}</span>
          </div>
          <div className="metricCell">
            <span className="metricLabel">{tk("metricStrongTape")}</span>
            <span className="metricValue mono text-bull">{aggregates.strong}</span>
          </div>
          <div className="metricCell">
            <span className="metricLabel">{tk("metricFloorGap")}</span>
            <span className="metricValue mono text-bull">{aggregates.cheap}</span>
          </div>
          <div className="metricCell">
            <span className="metricLabel">{tk("metric24hPrints")}</span>
            <span className="metricValue mono">{aggregates.totalVol}</span>
          </div>
        </section>

        <div className="toolbar">
          <div className="tabs" role="tablist" aria-label={tk("tabFilterAria")}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "all"}
              className={tab === "all" ? "active" : ""}
              onClick={() => setTab("all")}
            >
              {tk("tabAll")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "undervalued"}
              className={tab === "undervalued" ? "active" : ""}
              onClick={() => setTab("undervalued")}
            >
              {tk("tabFloorDiscount")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "strong"}
              className={tab === "strong" ? "active" : ""}
              onClick={() => setTab("strong")}
            >
              {tk("tabHighScore")}
            </button>
          </div>
          <div className="toolbarActions">
            <button type="button" className="addGiftTrigger" onClick={openGiftModal}>
              {tk("addListing")}
            </button>
            <button type="button" className="alertButton" onClick={handleTestAlert}>
              {tk("testDeskAlert")}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loadingPanel">
            <div className="skeletonGrid" aria-hidden="true">
              {[1, 2, 3].map((k) => (
                <div key={k} className="skeletonCard" />
              ))}
            </div>
            <p className="loading mono">{tk("loadingText")}</p>
          </div>
        ) : filteredGifts.length === 0 ? (
          <p className="empty mono">{tk("emptyFilter")}</p>
        ) : (
          <section className="grid">
            {filteredGifts.map((gift) => (
              <GiftCard key={gift.id} gift={gift} lang={lang} tk={tk} />
            ))}
          </section>
        )}
      </main>

      {giftModalOpen && (
        <div className="modalOverlay" role="presentation">
          <button
            type="button"
            className="modalBackdrop"
            aria-label={tk("closeDialogAria")}
            onClick={closeGiftModal}
          />
          <div
            className="modalSheet modalSheetPremium"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gift-modal-title"
          >
            <header className="modalHeader modalHeaderPremium">
              <div className="modalHeaderText">
                <p className="modalKicker">{tk("modalKicker")}</p>
                <h2 id="gift-modal-title">{tk("modalTitle")}</h2>
                <p>{tk("modalBody")}</p>
              </div>
              <button
                type="button"
                className="modalClose"
                onClick={closeGiftModal}
                aria-label={tk("ariaCloseModal")}
              >
                ×
              </button>
            </header>
            <div className="modalBody">
              <form className="giftForm" onSubmit={handleAddGift} noValidate>
                <label className="formField formFieldGrow">
                  <span className="formLabel">{tk("formListingName")}</span>
                  <input
                    type="text"
                    name="name"
                    autoComplete="off"
                    value={giftForm.name}
                    onChange={(ev) => updateGiftField("name", ev.target.value)}
                    placeholder={tk("phListingName")}
                    disabled={giftSubmitting}
                  />
                </label>
                <label className="formField formFieldGrow">
                  <span className="formLabel">{tk("formCollection")}</span>
                  <input
                    type="text"
                    name="collection"
                    autoComplete="off"
                    value={giftForm.collection}
                    onChange={(ev) => updateGiftField("collection", ev.target.value)}
                    placeholder={tk("phCollection")}
                    disabled={giftSubmitting}
                  />
                </label>
                <label className="formField formFieldGrow">
                  <span className="formLabel">{tk("formImageUrl")}</span>
                  <input
                    type="url"
                    name="image"
                    autoComplete="off"
                    value={giftForm.image}
                    onChange={(ev) => updateGiftField("image", ev.target.value)}
                    placeholder={tk("phImageUrl")}
                    disabled={giftSubmitting}
                  />
                </label>
                <div className="formRow">
                  <label className="formField">
                    <span className="formLabel">{tk("formPriceTon")}</span>
                    <input
                      type="number"
                      name="priceTon"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={giftForm.priceTon}
                      onChange={(ev) => updateGiftField("priceTon", ev.target.value)}
                      disabled={giftSubmitting}
                    />
                  </label>
                  <label className="formField">
                    <span className="formLabel">{tk("formFloorTon")}</span>
                    <input
                      type="number"
                      name="floorTon"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={giftForm.floorTon}
                      onChange={(ev) => updateGiftField("floorTon", ev.target.value)}
                      disabled={giftSubmitting}
                    />
                  </label>
                  <label className="formField">
                    <span className="formLabel">{tk("formRarity")}</span>
                    <input
                      type="number"
                      name="rarity"
                      inputMode="numeric"
                      min="1"
                      max="100"
                      step="1"
                      value={giftForm.rarity}
                      onChange={(ev) => updateGiftField("rarity", ev.target.value)}
                      placeholder={tk("phRarity")}
                      disabled={giftSubmitting}
                    />
                  </label>
                </div>
                {giftFormError && (
                  <p className="formError mono" role="alert">
                    {giftFormError}
                  </p>
                )}
                <div className="formActions">
                  <button
                    type="button"
                    className="formActionsSecondary"
                    onClick={closeGiftModal}
                    disabled={giftSubmitting}
                  >
                    {tk("cancelBtn")}
                  </button>
                  <button
                    type="submit"
                    className="submitGiftButton"
                    disabled={giftSubmitting}
                  >
                    {giftSubmitting ? tk("submittingLabel") : tk("submitListing")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GiftCard({ gift, lang, tk }) {
  const spread = Math.max(0, Math.min(100, gift.undervaluedPercent));
  const volTone =
    gift.volumeGrowth > 0 ? "text-bull" : gift.volumeGrowth < 0 ? "text-bear" : "text-muted";
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const imageUrl = typeof gift.image === "string" ? gift.image.trim() : "";

  useEffect(() => {
    setImgFailed(false);
    setImgLoaded(false);
  }, [imageUrl, gift.id]);

  const showRealImage = Boolean(imageUrl) && !imgFailed;
  const showSkeleton = showRealImage && !imgLoaded;
  const showFallback = !imageUrl || imgFailed;

  return (
    <article className={`card cardGlass card--gift ${signalClass(gift.signal)}`}>
      <div className="cardMedia" aria-busy={showSkeleton}>
        <div className="cardMediaFrame">
          {showSkeleton ? (
            <div className="cardImgSkeleton" aria-hidden="true" />
          ) : null}
          {showRealImage ? (
            <img
              src={imageUrl}
              alt=""
              width={640}
              height={640}
              className={`cardImg ${imgLoaded ? "cardImg--loaded" : ""}`}
              loading="lazy"
              decoding="async"
              sizes="(max-width: 480px) 92vw, (max-width: 900px) 45vw, 300px"
              onLoad={() => setImgLoaded(true)}
              onError={() => {
                console.warn("[GiftCard] image load failed", {
                  id: gift.id,
                  name: gift.name,
                  url: imageUrl,
                });
                setImgFailed(true);
                setImgLoaded(false);
              }}
            />
          ) : null}
          {showFallback ? (
            <div className="cardImageFallback cardImageFallback--hero" role="img" aria-label={gift.name}>
              <div className="cardImageFallbackGlow" aria-hidden="true" />
              <span className="cardImageFallbackRing" aria-hidden="true" />
              <span className="cardImageFallbackName">{gift.name}</span>
              <span className="cardImageFallbackBrand" aria-hidden="true">
                {tk("fallbackBrand")}
              </span>
            </div>
          ) : null}
          <div className="cardMediaShade" aria-hidden="true" />
        </div>
      </div>

      <div className="cardBadgeRow">
        <div className="badgeAi mono" title={tk("badgeScoreTitle")}>
          <span className="badgeAiLabel">{tk("badgeScoreLabel")}</span>
          <span className="badgeAiValue">{gift.aiScore}</span>
        </div>
        <span className={`badgeSignal ${signalClass(gift.signal)}`}>
          {translateSignal(lang, gift.signal)}
        </span>
        <span className="badgeRowSpacer" aria-hidden="true" />
        <span
          className={`badgeEdge mono ${spread >= 15 ? "badgeEdge--hot" : ""}`}
          title={tk("edgeTitle")}
        >
          {gift.undervaluedPercent}% {tk("edgeSuffix")}
        </span>
        {gift.status ? (
          <span className={statusBadgeClass(gift.status)}>
            {translateStatus(lang, gift.status)}
          </span>
        ) : null}
      </div>

      <div className="cardBody">
        <div className="cardHead">
          <div>
            <h2>{gift.name}</h2>
            <p className="collection mono">{gift.collection}</p>
          </div>
        </div>

        <div className="priceRow">
          <div>
            <span className="fieldLabel">{tk("fieldAsk")}</span>
            <span className="mono price">{gift.priceTon} TON</span>
          </div>
          <div>
            <span className="fieldLabel">{tk("fieldRefFloor")}</span>
            <span className="mono price dim">{gift.floorTon} TON</span>
          </div>
          <div>
            <span className="fieldLabel">{tk("fieldDepth")}</span>
            <span className={`mono price ${spread >= 15 ? "text-bull" : ""}`}>{spread}%</span>
          </div>
        </div>

        <div className="depthBar" aria-hidden="true" title={tk("depthBarTitle")}>
          <div className="depthFill" style={{ width: `${spread}%` }} />
        </div>

        <div className="metaRow mono">
          <span>
            {tk("metaRarity")} <b>{gift.rarity}</b>
          </span>
          <span>
            {tk("meta24h")} <b>{gift.sales24h}</b>
          </span>
          <span className={volTone}>
            {tk("metaVol")} <b>{formatSignedPct(gift.volumeGrowth)}</b>
          </span>
        </div>

        <div className="tagRow">
          <span className="tag tagMuted">
            {translateLiquidityRisk(lang, gift.liquidity, "liq")}
          </span>
          <span className="tag tagMuted">
            {translateLiquidityRisk(lang, gift.risk, "risk")}
          </span>
        </div>

        <p className="explanation">{deskNote(lang, gift)}</p>
      </div>
    </article>
  );
}
