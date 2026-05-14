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
  giftLink: "",
  priceTon: "",
  sellerNote: "",
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

/** Only load <img> for plausible remote URLs (avoids broken-icon flashes for bad strings). */
function isRenderableImageUrl(url) {
  const u = typeof url === "string" ? url.trim() : "";
  if (!u) return false;
  return /^https?:\/\//i.test(u);
}

function statusBadgeClass(status) {
  if (status === "pending") return "badgeStatus badgeStatus-pending";
  if (status === "approved") return "badgeStatus badgeStatus-approved";
  return "badgeStatus";
}

function nftCardModifier(signal) {
  const c = signalClass(signal);
  if (c === "signal-bull") return "nftCard--bull";
  if (c === "signal-watch") return "nftCard--watch";
  if (c === "signal-risk") return "nftCard--risk";
  return "nftCard--neutral";
}

function nftStatusCardClass(status) {
  if (status === "pending") return "nftCardStatus nftCardStatus--pending";
  if (status === "approved") return "nftCardStatus nftCardStatus--approved";
  return "nftCardStatus";
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
  const [detailGift, setDetailGift] = useState(null);

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

  const anyModalOpen = giftModalOpen || Boolean(detailGift);

  useEffect(() => {
    if (!anyModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [anyModalOpen]);

  useEffect(() => {
    if (!anyModalOpen) return;
    function onKey(e) {
      if (e.key !== "Escape") return;
      if (giftModalOpen) {
        setGiftModalOpen(false);
        setGiftFormError(null);
        setGiftForm(emptyGiftForm);
        return;
      }
      setDetailGift(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anyModalOpen, giftModalOpen]);

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

    const giftLinkTrim = giftForm.giftLink.trim();
    const sellerNoteTrim = giftForm.sellerNote.trim();
    const priceTon = Number(giftForm.priceTon);

    if (!giftLinkTrim) {
      setGiftFormError(t(lang, "errGiftLinkRequired"));
      return;
    }
    if (!Number.isFinite(priceTon) || priceTon <= 0) {
      setGiftFormError(t(lang, "errPricePositive"));
      return;
    }

    const payload = {
      giftLink: giftLinkTrim,
      priceTon,
      sellerNote: sellerNoteTrim,
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
    <div className="shell shell--miniapp">
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
            <div className="premiumTickerGrid" role="list">
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
          <section className="nftFeedGrid">
            {filteredGifts.map((gift) => (
              <GiftCard
                key={gift.id}
                gift={gift}
                lang={lang}
                tk={tk}
                onOpen={() => {
                  try {
                    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
                  } catch {
                    /* ignore */
                  }
                  setDetailGift(gift);
                }}
              />
            ))}
          </section>
        )}
      </main>

      {detailGift && (
        <GiftDetailSheet gift={detailGift} lang={lang} tk={tk} onClose={() => setDetailGift(null)} />
      )}

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
                  <span className="formLabel">{tk("formGiftLink")}</span>
                  <input
                    type="text"
                    name="giftLink"
                    autoComplete="off"
                    value={giftForm.giftLink}
                    onChange={(ev) => updateGiftField("giftLink", ev.target.value)}
                    placeholder={tk("phGiftLink")}
                    disabled={giftSubmitting}
                  />
                </label>
                <p className="formHint mono">{tk("hintGiftResolver")}</p>
                <label className="formField formFieldGrow">
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
                <label className="formField formFieldGrow">
                  <span className="formLabel">{tk("formSellerNote")}</span>
                  <textarea
                    name="sellerNote"
                    rows={3}
                    className="formTextarea"
                    autoComplete="off"
                    value={giftForm.sellerNote}
                    onChange={(ev) => updateGiftField("sellerNote", ev.target.value)}
                    placeholder={tk("phSellerNote")}
                    disabled={giftSubmitting}
                  />
                </label>
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

function GiftCard({ gift, lang, tk, onOpen }) {
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const rawImage = typeof gift.image === "string" ? gift.image.trim() : "";
  const imageUrl = isRenderableImageUrl(rawImage) ? rawImage : "";

  useEffect(() => {
    setImgFailed(false);
    setImgLoaded(false);
  }, [imageUrl, gift.id]);

  const showRealImage = Boolean(imageUrl) && !imgFailed;
  const showSkeleton = showRealImage && !imgLoaded;
  const showFallback = !imageUrl || imgFailed;

  const mod = nftCardModifier(gift.signal);

  return (
    <button
      type="button"
      className={`nftCard ${mod}`}
      onClick={onOpen}
      aria-label={`${gift.name}, ${gift.priceTon} TON`}
    >
      <div className="nftCardMediaWrap" aria-busy={showSkeleton}>
        <div className="nftCardMediaInner">
          {showSkeleton ? <div className="nftCardImgSkel" aria-hidden="true" /> : null}
          {showRealImage ? (
            <img
              src={imageUrl}
              alt=""
              width={512}
              height={512}
              className={`nftCardImg ${imgLoaded ? "nftCardImg--loaded" : ""}`}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              sizes="(max-width: 480px) 46vw, 200px"
              draggable={false}
              onLoad={() => setImgLoaded(true)}
              onError={() => {
                setImgFailed(true);
                setImgLoaded(false);
              }}
            />
          ) : null}
          {showFallback ? (
            <div className="nftCardFb" role="img" aria-label={gift.name}>
              <span className="nftCardFbName">{gift.name}</span>
            </div>
          ) : null}
        </div>
        <span className="nftCardScore" title={tk("badgeScoreTitle")}>
          {gift.aiScore}
        </span>
      </div>

      <div className="nftCardMeta">
        <h3 className="nftCardTitle">{gift.name}</h3>
        <p className="nftCardCollection mono">{gift.collection}</p>
        <p className="nftCardId" title={gift.id}>
          {tk("detailGiftId")}: {gift.id}
        </p>
        <div className="nftCardPriceBox">
          <span className="nftCardPrice">
            {gift.priceTon}
            <span className="nftCardPriceUnit">TON</span>
          </span>
        </div>
        {gift.status ? (
          <div className="nftCardStatusRow">
            <span className={nftStatusCardClass(gift.status)}>
              {translateStatus(lang, gift.status)}
            </span>
          </div>
        ) : null}
      </div>
    </button>
  );
}

function GiftDetailSheet({ gift, lang, tk, onClose }) {
  const spread = Math.max(0, Math.min(100, gift.undervaluedPercent));
  const volTone =
    gift.volumeGrowth > 0 ? "text-bull" : gift.volumeGrowth < 0 ? "text-bear" : "text-muted";
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const rawImage = typeof gift.image === "string" ? gift.image.trim() : "";
  const imageUrl = isRenderableImageUrl(rawImage) ? rawImage : "";

  useEffect(() => {
    setImgFailed(false);
    setImgLoaded(false);
  }, [imageUrl, gift.id]);

  const showRealImage = Boolean(imageUrl) && !imgFailed;
  const showFallback = !imageUrl || imgFailed;

  return (
    <div className="nftDetailOverlay" role="presentation">
      <button type="button" className="nftDetailBackdrop" aria-label={tk("closeDialogAria")} onClick={onClose} />
      <div
        className="nftDetailSheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nft-detail-title"
      >
        <header className="nftDetailHeader">
          <div className="nftDetailHeaderText">
            <p className="nftDetailKicker">{tk("detailSheetKicker")}</p>
            <h2 id="nft-detail-title" className="nftDetailTitle">
              {gift.name}
            </h2>
            <p className="nftDetailSub mono">
              {tk("detailGiftId")}: {gift.id}
            </p>
          </div>
          <button type="button" className="nftDetailClose" onClick={onClose} aria-label={tk("ariaCloseModal")}>
            ×
          </button>
        </header>

        <div className="nftDetailScroll">
          <div className="nftDetailHeroImg">
            {showRealImage ? (
              <img
                src={imageUrl}
                alt={gift.name}
                width={640}
                height={640}
                className={`nftHeroImg ${imgLoaded ? "nftHeroImg--loaded" : ""}`}
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
                onLoad={() => setImgLoaded(true)}
                onError={() => {
                  setImgFailed(true);
                  setImgLoaded(false);
                }}
              />
            ) : (
              <div className="nftCardFb" style={{ position: "absolute", inset: 0 }}>
                <span className="nftCardFbName">{gift.name}</span>
              </div>
            )}
          </div>

          <p className="nftCardCollection mono" style={{ margin: "0 0 12px", fontSize: 11 }}>
            {gift.collection}
          </p>

          <div className="nftDetailChips">
            <span className="nftDetailChip nftDetailChip--score" title={tk("badgeScoreTitle")}>
              {tk("badgeScoreLabel")} {gift.aiScore}
            </span>
            <span className={`badgeSignal ${signalClass(gift.signal)}`}>{translateSignal(lang, gift.signal)}</span>
            {gift.status ? (
              <span className={statusBadgeClass(gift.status)}>{translateStatus(lang, gift.status)}</span>
            ) : null}
          </div>

          <section className="nftDetailSection">
            <h3 className="nftDetailSectionTitle">{tk("detailSectionTape")}</h3>
            <div className="nftDetailStatGrid">
              <div className="nftDetailStat">
                <span className="nftDetailStatLabel">{tk("fieldAsk")}</span>
                <span className="nftDetailStatValue">{gift.priceTon} TON</span>
              </div>
              <div className="nftDetailStat">
                <span className="nftDetailStatLabel">{tk("fieldRefFloor")}</span>
                <span className="nftDetailStatValue">{gift.floorTon} TON</span>
              </div>
              <div className="nftDetailStat">
                <span className="nftDetailStatLabel">{tk("fieldDepth")}</span>
                <span className={`nftDetailStatValue ${spread >= 15 ? "text-bull" : ""}`}>{spread}%</span>
              </div>
            </div>
            <div className="nftDetailBar" aria-hidden="true" title={tk("depthBarTitle")}>
              <div className="nftDetailBarFill" style={{ width: `${spread}%` }} />
            </div>
            <div className="tagRow" style={{ marginTop: 10 }}>
              <span className="tag tagMuted">{translateLiquidityRisk(lang, gift.liquidity, "liq")}</span>
              <span className="tag tagMuted">{translateLiquidityRisk(lang, gift.risk, "risk")}</span>
            </div>
          </section>

          <section className="nftDetailSection">
            <h3 className="nftDetailSectionTitle">{tk("detailSectionSignals")}</h3>
            <div className="nftDetailStatGrid nftDetailStatGrid--pair">
              <div className="nftDetailStat">
                <span className="nftDetailStatLabel">{tk("edgeTitle")}</span>
                <span className="nftDetailStatValue">
                  {gift.undervaluedPercent}% {tk("edgeSuffix")}
                </span>
              </div>
              <div className="nftDetailStat">
                <span className="nftDetailStatLabel">{tk("metaRarity")}</span>
                <span className="nftDetailStatValue">{gift.rarity}</span>
              </div>
            </div>
          </section>

          <section className="nftDetailSection">
            <h3 className="nftDetailSectionTitle">{tk("detailHistory")}</h3>
            <div className="nftDetailStatGrid nftDetailStatGrid--pair">
              <div className="nftDetailStat">
                <span className="nftDetailStatLabel">{tk("meta24h")}</span>
                <span className="nftDetailStatValue">{gift.sales24h ?? 0}</span>
              </div>
              <div className="nftDetailStat">
                <span className="nftDetailStatLabel">{tk("detailVolatility")}</span>
                <span className={`nftDetailStatValue ${volTone}`}>{formatSignedPct(gift.volumeGrowth)}</span>
              </div>
            </div>
          </section>

          <section className="nftDetailSection">
            <h3 className="nftDetailSectionTitle">{tk("detailSectionNarrative")}</h3>
            <p className="nftDetailNarrative">{deskNote(lang, gift)}</p>
          </section>

          {(gift.sellerNote || gift.giftLink) && (
            <section className="nftDetailSection">
              <h3 className="nftDetailSectionTitle">{tk("detailSectionContext")}</h3>
              {gift.sellerNote ? (
                <p className="nftDetailNarrative">
                  <strong>{tk("detailSellerNote")}:</strong> {gift.sellerNote}
                </p>
              ) : null}
              {gift.giftLink ? (
                <a className="nftDetailLink mono" href={gift.giftLink} target="_blank" rel="noopener noreferrer">
                  {tk("detailGiftLink")}
                </a>
              ) : null}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
