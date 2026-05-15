import { useEffect, useMemo, useState } from "react";
import { addGift, getGifts, sendTestAlert } from "./api";
import GiftAnimatedHero from "./GiftAnimatedHero.jsx";
import GiftCollectibleHeroStage from "./GiftCollectibleHeroStage.jsx";
import {
  bestStaticRasterUrl,
  cardRasterSources,
  detailHeroPosterUrl,
  giftImageFieldsForDebug,
  giftMediaFit,
  isImageDebugEnabled,
  isOpenGraphMediaFallback,
  isRenderableMediaUrl,
  logGiftImageChoice,
} from "./giftVisual.js";
import {
  LANG_STORAGE_KEY,
  getInitialLanguage,
  t,
  translateLiquidityRisk,
  translateServerMessage,
  translateSignal,
  translateStatus,
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

  const anyUpscalePending = useMemo(
    () => gifts.some((g) => String(g.imageUpscaleStatus) === "pending"),
    [gifts]
  );

  /** Background listings already show; poll lightly until Replicate finishes so cards/sheet pick up `imageHiRes`. */
  useEffect(() => {
    if (!anyUpscalePending) return undefined;
    const id = window.setInterval(() => {
      getGifts()
        .then((data) => setGifts(data))
        .catch((err) => console.error(err));
    }, 4500);
    return () => window.clearInterval(id);
  }, [anyUpscalePending]);

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

      <header className="topbar topbar--terminal">
        <div className="brand">
          <span className="brandMark" aria-hidden="true" />
          <div className="brandLockup">
            <span className="brandQuanton">Quanton</span>
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
        </div>
      </header>

      <main className="app app--terminal">
        <div className="feedHead">
          <div className="feedHead__row">
            <p className="feedHead__tagline">{tk("feedTagline")}</p>
            <span className="feedHead__live">
              <span className="liveDot liveDot--subtle" aria-hidden="true" />
              {tk("livePill")}
            </span>
          </div>
          <p className="feedHead__stats mono" aria-label={tk("metricsOverviewAria")}>
            <span>
              {gifts.length} {tk("statListings")}
            </span>
            <span className="feedHead__sep" aria-hidden="true">
              ·
            </span>
            <span>
              {tk("statAvg")} {aggregates.avgScore}
            </span>
            <span className="feedHead__sep" aria-hidden="true">
              ·
            </span>
            <span className="text-bull">
              {aggregates.strong} {tk("statStrong")}
            </span>
            <span className="feedHead__sep" aria-hidden="true">
              ·
            </span>
            <span>
              {aggregates.cheap} {tk("statGap")}
            </span>
            <span className="feedHead__sep" aria-hidden="true">
              ·
            </span>
            <span>
              {aggregates.totalVol} {tk("statPrints")}
            </span>
          </p>
          {ticker.length > 0 ? (
            <div className="tickerStrip" role="list" aria-label={tk("tickerAria")}>
              <div className="tickerStrip__scroll">
                {ticker.map((row) => (
                  <span key={row.id} className="tickerStrip__chip mono" role="listitem" title={translateSignal(lang, row.signal)}>
                    <span className="tickerStrip__rank">#{row.rank}</span>
                    {row.label}
                    <span className="tickerStrip__score">{row.score}</span>
                    <span className={row.gap >= 15 ? "text-bull" : "text-muted"}>{formatSignedPct(row.gap)}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

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

/** Bold headline + model or token line (Portals-style; no internal IDs). */
function giftCardTitleLines(gift) {
  const name = String(gift?.name ?? "").trim();
  const coll = String(gift?.collection ?? "").trim();
  const model = String(gift?.model ?? "").trim();
  const m = name.match(/^(.+?)\s+(#\d+)\s*$/);
  if (m && m[1].trim()) {
    const primary = `${m[1].trim()} ${m[2].trim()}`;
    return { primary, secondary: model || "" };
  }
  if (name) {
    return {
      primary: name,
      secondary: model || (coll && coll !== name ? coll : ""),
    };
  }
  return { primary: coll || "—", secondary: model || "" };
}

function GiftCard({ gift, lang, tk, onOpen }) {
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const { primary: cardTitle, secondary: cardSub } = giftCardTitleLines(gift);

  const { src: imageUrl, srcSet, ogOnly } = cardRasterSources(gift);
  const renderable = isRenderableMediaUrl(imageUrl);
  const fit = giftMediaFit(gift);
  const fitClass = fit === "cover" ? "nftCardImg--cover" : "nftCardImg--contain";
  const ogFallback = ogOnly || isOpenGraphMediaFallback(gift);

  useEffect(() => {
    logGiftImageChoice("card", gift, { src: imageUrl, srcSet });
  }, [gift, imageUrl, srcSet]);

  useEffect(() => {
    setImgFailed(false);
    setImgLoaded(false);
  }, [imageUrl, srcSet, gift.id]);

  const showRealImage = renderable && !imgFailed;
  const showSkeleton = showRealImage && !imgLoaded;
  const showFallback = !renderable || imgFailed;

  const mod = nftCardModifier(gift.signal);

  return (
    <button
      type="button"
      className={`nftCard ${mod}`}
      onClick={onOpen}
      aria-label={`${gift.name}, ${gift.priceTon} TON`}
    >
      <div
        className={`nftCardMediaWrap${ogFallback ? " nftCardMediaWrap--ogFallback" : ""}`}
        aria-busy={showSkeleton}
      >
        <div className="nftCardMediaInner">
          {showSkeleton ? <div className="nftCardImgSkel" aria-hidden="true" /> : null}
          {showRealImage ? (
            <img
              src={imageUrl}
              srcSet={srcSet}
              alt=""
              width={512}
              height={512}
              className={`nftCardImg ${fitClass} ${ogFallback ? "nftCardImg--ogFallback " : ""}${imgLoaded ? "nftCardImg--loaded" : ""}`}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              sizes="(max-width: 480px) 42vw, (max-width: 900px) 28vw, 240px"
              draggable={false}
              fetchPriority="low"
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
        {gift.animationUrl ? (
          <span className="nftCardAnimHint" title={tk("animHintTitle")}>
            {tk("animHintShort")}
          </span>
        ) : null}
      </div>

      <div className="nftCardMeta">
        <h3 className="nftCardTitle">{cardTitle}</h3>
        {cardSub ? (
          <p className="nftCardSubline mono">{cardSub}</p>
        ) : null}
        <div className="nftCardPriceRail">
          <span className="nftCardPricePill" aria-hidden="true">
            <span className="nftCardPricePillValue">{gift.priceTon}</span>
            <span className="nftCardPricePillUnit">TON</span>
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

function collectibleProfileHandle(gift) {
  const u = gift?.telegramUser;
  if (!u || typeof u !== "object") return "";
  const un = u.username;
  if (typeof un === "string" && un.trim()) return `@${un.trim()}`;
  const fn = u.first_name;
  if (typeof fn === "string" && fn.trim()) return fn.trim();
  return "";
}

function GiftDetailSheet({ gift, lang, tk, onClose }) {
  const spread = Math.max(0, Math.min(100, gift.undervaluedPercent));
  const volTone =
    gift.volumeGrowth > 0 ? "text-bull" : gift.volumeGrowth < 0 ? "text-bear" : "text-muted";

  const liveFloorTon = (() => {
    const r = Number(gift.realFloorTon);
    if (Number.isFinite(r) && r > 0) return r;
    const f = Number(gift.floorTon);
    return Number.isFinite(f) && f > 0 ? f : 0;
  })();

  const heroPoster = detailHeroPosterUrl(gift);
  const staticRaster = bestStaticRasterUrl(gift);
  const mediaFit = giftMediaFit(gift);
  const ogFallback = isOpenGraphMediaFallback(gift);
  const showImageDebug = isImageDebugEnabled();
  const debugFields = showImageDebug ? giftImageFieldsForDebug(gift) : null;

  useEffect(() => {
    const card = cardRasterSources(gift);
    logGiftImageChoice("detail", gift, {
      src: card.src,
      srcSet: card.srcSet,
      heroPoster,
    });
  }, [gift, heroPoster]);

  useEffect(() => {
    const href = heroPoster || staticRaster;
    if (!isRenderableMediaUrl(href)) return undefined;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = href;
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, [gift.id, heroPoster, staticRaster]);

  const showHdBadge = gift.imageUpscaled === true;
  const profileHandle = collectibleProfileHandle(gift);

  return (
    <div className="nftDetailOverlay" role="presentation">
      <button type="button" className="nftDetailBackdrop" aria-label={tk("closeDialogAria")} onClick={onClose} />
      <div
        className="nftDetailSheet nftDetailSheet--collectibleProfile"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nft-detail-title"
      >
        <div className="tgCollectibleCard">
          <div className="tgCollectibleCard__backdrop" aria-hidden="true">
            <GiftCollectibleHeroStage gift={gift} variant="collectibleProfile" backdropOnly />
          </div>

          <div className="tgCollectibleCard__body">
            <div className="tgCollectibleToolbar">
              <button
                type="button"
                className="tgCollectibleCircleBtn tgCollectibleCircleBtn--close"
                onClick={onClose}
                aria-label={tk("collectibleCloseAria")}
              >
                <span className="tgCollectibleCircleBtn__x" aria-hidden="true">
                  ×
                </span>
              </button>
              <button
                type="button"
                className="tgCollectibleCircleBtn tgCollectibleCircleBtn--menu"
                aria-label={tk("collectibleMenuAria")}
              >
                <span className="tgCollectibleCircleBtn__dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </button>
            </div>

            <div className="tgCollectibleHero">
              <div
                className={`tgCollectibleHeroImg${ogFallback ? " tgCollectibleHeroImg--ogFallback" : ""}`}
              >
                <GiftAnimatedHero
                  animationUrl={gift.animationUrl}
                  posterUrl={heroPoster}
                  alt={gift.name}
                  mediaFit={mediaFit}
                />
              </div>
            </div>

            <div className="tgCollectibleHeadline">
              <h2 id="nft-detail-title" className="tgCollectibleTitle">
                {gift.name}
              </h2>
              <p className="tgCollectibleUsername">{profileHandle || "—"}</p>
            </div>

            <div className="tgCollectibleScroll">
              <div className="nftDetailChips tgCollectibleChips">
                <span className="nftDetailChip nftDetailChip--score" title={tk("badgeScoreTitle")}>
                  {tk("badgeScoreLabel")} {gift.aiScore}
                </span>
                <span className={`badgeSignal ${signalClass(gift.signal)}`}>{translateSignal(lang, gift.signal)}</span>
                {gift.status ? (
                  <span className={statusBadgeClass(gift.status)}>{translateStatus(lang, gift.status)}</span>
                ) : null}
                {gift.imageUpscaleStatus === "pending" ? (
                  <span className="nftDetailChip nftDetailChip--pending" title={tk("badgeUpscalingTitle")}>
                    {tk("badgeUpscalingDetail")}
                  </span>
                ) : null}
                {showHdBadge ? (
                  <span className="nftDetailChip nftDetailChip--enhanced" title={tk("badgeEnhancedTitle")}>
                    {tk("badgeEnhancedShort")}
                  </span>
                ) : null}
                {showImageDebug && gift.mediaSource ? (
                  <span className="nftDetailChip nftDetailChip--media" title="Media source">
                    {gift.mediaSource}
                    {gift.mediaMatchLevel ? ` · ${gift.mediaMatchLevel}` : ""}
                  </span>
                ) : null}
              </div>

              {showImageDebug && debugFields ? (
            <section
              className="nftDetailSection"
              style={{ borderTop: "1px dashed rgba(255,255,255,0.15)", paddingTop: 12 }}
            >
              <h3 className="nftDetailSectionTitle" style={{ color: "#fbbf24" }}>
                Image debug (original vs upscaled)
              </h3>
              <p className="mono" style={{ fontSize: 11, opacity: 0.85, margin: "0 0 8px" }}>
                Enable with <code>?imageDebug=1</code> or{" "}
                <code>localStorage.setItem(&quot;quantonImageDebug&quot;,&quot;1&quot;)</code>
              </p>
              <div style={{ display: "grid", gap: 10, fontSize: 11 }}>
                <div>
                  <strong style={{ color: "#94a3b8" }}>traits</strong>
                  <pre
                    style={{
                      margin: "4px 0 0",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      opacity: 0.95,
                    }}
                  >
                    {`collection: ${debugFields.collection || "—"}\nmodel: ${debugFields.model || "—"}\nbackdrop: ${debugFields.backdrop || "—"}\nsymbol: ${debugFields.symbol || "—"}\nbackdropTheme: ${debugFields.backdropThemeKey || "—"}\nsymbolPattern: ${debugFields.symbolPatternId || "—"}`}
                  </pre>
                </div>
                <div>
                  <strong style={{ color: "#94a3b8" }}>heroBackground.gradient (snippet)</strong>
                  <pre
                    style={{
                      margin: "4px 0 0",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      opacity: 0.95,
                    }}
                  >
                    {debugFields.heroBackgroundSnippet || "—"}
                  </pre>
                </div>
                <div>
                  <strong style={{ color: "#94a3b8" }}>resolved image (public → legacy)</strong>
                  <pre
                    style={{
                      margin: "4px 0 0",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      opacity: 0.95,
                    }}
                  >
                    {`resolvedImageUrl: ${debugFields.resolvedImageUrl || "—"}\nconstructedModelImageUrl: ${debugFields.constructedModelImageUrl || "—"}\nimageSourceField: ${debugFields.imageSourceField || "—"}\nimageResolutionSource: ${debugFields.imageResolutionSource || "—"}\nimageFromPublicField: ${String(debugFields.imageFromPublicField)}\nimageRejectedReason: ${debugFields.imageRejectedReason || "—"}\nrejectedImageUrl: ${debugFields.rejectedImageUrl || "—"}\nrejectedField: ${debugFields.rejectedField || "—"}\nimageCheckedFields: ${debugFields.imageCheckedFields || "—"}\ngift.public keys: ${debugFields.giftPublicKeys || "—"}`}
                  </pre>
                </div>
                <div>
                  <strong style={{ color: "#94a3b8" }}>image (API)</strong>
                  <pre
                    style={{
                      margin: "4px 0 0",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      opacity: 0.95,
                    }}
                  >
                    {debugFields.image || "—"}
                  </pre>
                </div>
                <div>
                  <strong style={{ color: "#94a3b8" }}>imageThumb</strong>
                  <pre
                    style={{
                      margin: "4px 0 0",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      opacity: 0.95,
                    }}
                  >
                    {debugFields.imageThumb || "—"}
                  </pre>
                </div>
                <div>
                  <strong style={{ color: "#94a3b8" }}>animationPosterUrl</strong>
                  <pre
                    style={{
                      margin: "4px 0 0",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      opacity: 0.95,
                    }}
                  >
                    {debugFields.animationPosterUrl || "—"}
                  </pre>
                </div>
                <div>
                  <strong style={{ color: "#94a3b8" }}>imageOriginal (OG / source)</strong>
                  <pre
                    style={{
                      margin: "4px 0 0",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      opacity: 0.95,
                    }}
                  >
                    {debugFields.imageOriginal || "—"}
                  </pre>
                </div>
                <div>
                  <strong style={{ color: "#94a3b8" }}>imageHiRes (API — should match Replicate after done)</strong>
                  <pre
                    style={{
                      margin: "4px 0 0",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      opacity: 0.95,
                    }}
                  >
                    {debugFields.imageHiRes || "—"}
                  </pre>
                </div>
                <div>
                  <strong style={{ color: "#94a3b8" }}>Rendered hero poster URL (cache-busted if HD)</strong>
                  <pre
                    style={{
                      margin: "4px 0 0",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      opacity: 0.95,
                    }}
                  >
                    {heroPoster || "—"}
                  </pre>
                </div>
                <div>
                  <strong style={{ color: "#94a3b8" }}>mediaSource · mediaMatchLevel</strong>
                  <pre
                    style={{
                      margin: "4px 0 0",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      opacity: 0.95,
                    }}
                  >
                    {`${debugFields.mediaSource || "—"} · ${debugFields.mediaMatchLevel || "—"}`}
                  </pre>
                </div>
                <div>
                  <strong style={{ color: "#94a3b8" }}>chosen image URL</strong>
                  <pre
                    style={{
                      margin: "4px 0 0",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      opacity: 0.95,
                    }}
                  >
                    {debugFields.chosenImageUrl || "—"}
                  </pre>
                </div>
                <div className="mono" style={{ opacity: 0.9 }}>
                  imageUpscaled: {String(debugFields.imageUpscaled)} · imageUpscaleStatus:{" "}
                  {debugFields.imageUpscaleStatus || "—"} · provider:{" "}
                  {String(gift.imageUpscaleProvider || "—")}
                </div>
              </div>
            </section>
          ) : null}

          <section className="nftDetailSection">
            <h3 className="nftDetailSectionTitle">{tk("detailSectionMarket")}</h3>
            <div className="nftDetailStatGrid nftDetailStatGrid--dense">
              <div className="nftDetailStat">
                <span className="nftDetailStatLabel">{tk("fieldAsk")}</span>
                <span className="nftDetailStatValue">{gift.priceTon} TON</span>
              </div>
              <div className="nftDetailStat">
                <span className="nftDetailStatLabel">{tk("detailLiveFloor")}</span>
                <span className="nftDetailStatValue nftDetailFloorValueRow">
                  {gift.floorIsLive ? (
                    <span
                      className="nftDetailLiveFloorDot"
                      title={tk("detailFloorLiveHint")}
                      aria-label={tk("livePill")}
                    />
                  ) : null}
                  {liveFloorTon} TON
                </span>
              </div>
              <div className="nftDetailStat">
                <span className="nftDetailStatLabel">{tk("fieldDepth")}</span>
                <span className={`nftDetailStatValue ${spread >= 15 ? "text-bull" : ""}`}>{spread}%</span>
              </div>
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
              <div className="nftDetailStat">
                <span className="nftDetailStatLabel">{tk("meta24h")}</span>
                <span className="nftDetailStatValue">{gift.sales24h ?? 0}</span>
              </div>
              <div className="nftDetailStat">
                <span className="nftDetailStatLabel">{tk("detailVolatility")}</span>
                <span className={`nftDetailStatValue ${volTone}`}>{formatSignedPct(gift.volumeGrowth)}</span>
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
    </div>
    </div>
  );
}
