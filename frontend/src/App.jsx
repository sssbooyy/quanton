import { useEffect, useMemo, useState } from "react";
import { addGift, getGifts, sendTestAlert } from "./api";
import GiftAnimatedHero from "./GiftAnimatedHero.jsx";
import GiftCollectibleHeroStage from "./GiftCollectibleHeroStage.jsx";
import {
  cacheBustMediaUrl,
  bestStaticRasterUrl,
  giftImageFieldsForDebug,
  giftMediaFit,
  isImageDebugEnabled,
  isOpenGraphMediaFallback,
  isRenderableMediaUrl,
  logGiftImageChoice,
} from "./giftVisual.js";
import { useGiftMainRasterImage } from "./useGiftMainRasterImage.js";
import {
  LANG_STORAGE_KEY,
  getInitialLanguage,
  listingStatusLabel,
  t,
  translateServerMessage,
} from "./translations";
import {
  giftMatchesAdvancedFilters,
  giftMatchesListingStatus,
  giftMatchesSearch,
  sortGiftList,
  uniqueCollections,
} from "./marketplaceBrowse.js";
import { useMarketplaceCart } from "./useMarketplaceCart.js";
import {
  extractBackdropLabelFromGift,
  resolveBackdropTraitSolid,
  resolveCollectibleHeroPresentation,
} from "@shared/giftHeroResolve.js";
import { resolveGiftCollectibleVisualLayers } from "@shared/giftCollectibleLayers.js";
import {
  giftBackdropLabel,
  giftListingIdDisplay,
  traitFloorTon,
  traitRarityBadgeText,
} from "./giftDetailPortals.js";

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

function statusBadgeClass(status) {
  if (status === "pending") return "badgeStatus badgeStatus-pending";
  if (status === "approved") return "badgeStatus badgeStatus-approved";
  return "badgeStatus";
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
  const [preset, setPreset] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState("newest");
  const [listingStatusFilter, setListingStatusFilter] = useState("all");
  const [advFilters, setAdvFilters] = useState({
    minPrice: "",
    maxPrice: "",
    collection: "",
    minRarity: "",
    minScore: "",
  });
  const [cartOpen, setCartOpen] = useState(false);
  const cart = useMarketplaceCart();
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

  const anyModalOpen = giftModalOpen || Boolean(detailGift) || cartOpen;

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
      if (cartOpen) {
        setCartOpen(false);
        return;
      }
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
  }, [anyModalOpen, giftModalOpen, cartOpen]);

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

  const collections = useMemo(() => uniqueCollections(gifts), [gifts]);

  const filteredGifts = useMemo(() => {
    let list = gifts;
    if (preset === "discount") {
      list = list.filter((g) => (Number(g.undervaluedPercent) || 0) >= 15);
    } else if (preset === "strong") {
      list = list.filter((g) => (Number(g.aiScore) || 0) >= 80);
    }
    list = list.filter((g) => giftMatchesListingStatus(g, listingStatusFilter));
    list = list.filter((g) => giftMatchesAdvancedFilters(g, advFilters));
    list = list.filter((g) => giftMatchesSearch(g, searchQuery));
    return sortGiftList(list, sortKey);
  }, [gifts, preset, listingStatusFilter, advFilters, searchQuery, sortKey]);

  function resetBrowseFilters() {
    setPreset("all");
    setSearchQuery("");
    setSortKey("newest");
    setListingStatusFilter("all");
    setAdvFilters({
      minPrice: "",
      maxPrice: "",
      collection: "",
      minRarity: "",
      minScore: "",
    });
  }

  return (
    <div className="shell shell--miniapp">
      {successToast && (
        <div className="successToast" role="status" aria-live="polite">
          {successToast}
        </div>
      )}

      <header className="topbar topbar--terminal">
        <div className="brand">
          <img
            className="brandLogo"
            src="/quanton-logo.png"
            alt=""
            width={32}
            height={32}
            decoding="async"
            draggable={false}
          />
          <div className="brandLockup">
            <span className="brandQuanton">Quanton</span>
          </div>
        </div>
        <div className="topbarRight">
          <button
            type="button"
            className="cartHeaderBtn"
            onClick={() => setCartOpen(true)}
            aria-label={tk("cartAria")}
          >
            <span className="cartHeaderBtn__icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M6 6h15l-1.5 9h-12z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 6 5 3H2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="9" cy="20" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="17" cy="20" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            </span>
            {cart.count > 0 ? (
              <span className="cartHeaderBtn__badge mono" aria-hidden="true">
                {cart.count > 99 ? "99+" : cart.count}
              </span>
            ) : null}
          </button>
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
          <div className="feedHead__row feedHead__row--collection">
            <div className="feedHead__identity">
              <p className="feedHead__tagline">{tk("feedTagline")}</p>
              <h1 className="feedHead__title">Quanton Marketplace</h1>
            </div>
            <span className="feedHead__live">
              <span className="liveDot liveDot--subtle" aria-hidden="true" />
              {tk("livePill")}
            </span>
          </div>
        </div>

        <div className="marketBrowseBar">
          <div className="marketSearchRow">
            <input
              type="search"
              className="marketSearchInput mono"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tk("searchPlaceholder")}
              enterKeyHint="search"
              autoComplete="off"
              aria-label={tk("searchPlaceholder")}
            />
          </div>

          <div className="marketPresets" role="group" aria-label={tk("tabFilterAria")}>
            <button
              type="button"
              className={preset === "all" ? "active" : ""}
              aria-pressed={preset === "all"}
              onClick={() => setPreset("all")}
            >
              {tk("presetAll")}
            </button>
            <button
              type="button"
              className={preset === "discount" ? "active" : ""}
              aria-pressed={preset === "discount"}
              onClick={() => setPreset("discount")}
            >
              {tk("presetDiscount")}
            </button>
          </div>

          <details className="marketFiltersDetails">
            <summary className="marketFiltersSummary">{tk("filterPanelTitle")}</summary>
            <div className="marketFiltersGrid">
              <label className="marketField">
                <span className="marketField__label">{tk("sortLabel")}</span>
                <select
                  className="marketSelect mono"
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value)}
                >
                  <option value="newest">{tk("sortNewest")}</option>
                  <option value="price_asc">{tk("sortPriceLow")}</option>
                  <option value="price_desc">{tk("sortPriceHigh")}</option>
                  <option value="floor_diff">{tk("sortFloorDiff")}</option>
                </select>
              </label>

              <div className="marketField marketField--status" role="group" aria-label={tk("filterListingStatusGroup")}>
                <span className="marketField__label">{tk("filterListingStatusGroup")}</span>
                <div className="marketStatusPills">
                  {(
                    [
                      ["all", tk("filterStatusAll")],
                      ["live", tk("filterStatusLive")],
                      ["pending", tk("filterStatusPending")],
                      ["sold", tk("filterStatusSold")],
                    ]
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      className={listingStatusFilter === val ? "active" : ""}
                      aria-pressed={listingStatusFilter === val}
                      onClick={() => setListingStatusFilter(val)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="marketField">
                <span className="marketField__label">{tk("filterPriceMin")}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  className="marketInput mono"
                  value={advFilters.minPrice}
                  onChange={(e) => setAdvFilters((p) => ({ ...p, minPrice: e.target.value }))}
                  min="0"
                  step="any"
                />
              </label>
              <label className="marketField">
                <span className="marketField__label">{tk("filterPriceMax")}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  className="marketInput mono"
                  value={advFilters.maxPrice}
                  onChange={(e) => setAdvFilters((p) => ({ ...p, maxPrice: e.target.value }))}
                  min="0"
                  step="any"
                />
              </label>

              <label className="marketField marketField--full">
                <span className="marketField__label">{tk("filterCollection")}</span>
                <select
                  className="marketSelect mono"
                  value={advFilters.collection}
                  onChange={(e) => setAdvFilters((p) => ({ ...p, collection: e.target.value }))}
                >
                  <option value="">{tk("filterCollectionAll")}</option>
                  {collections.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="marketField">
                <span className="marketField__label">{tk("filterMinRarity")}</span>
                <input
                  type="number"
                  className="marketInput mono"
                  value={advFilters.minRarity}
                  onChange={(e) => setAdvFilters((p) => ({ ...p, minRarity: e.target.value }))}
                  min="1"
                  max="100"
                  step="1"
                />
              </label>
              <div className="marketField marketField--full marketField--actions">
                <button type="button" className="marketResetBtn" onClick={resetBrowseFilters}>
                  {tk("filtersReset")}
                </button>
              </div>
            </div>
          </details>
        </div>

        <div className="toolbar">
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
                inCart={cart.has(gift.id)}
                onAddToCart={() => {
                  cart.add(gift);
                  try {
                    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
                  } catch {
                    /* ignore */
                  }
                }}
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
        <GiftDetailSheet
          gift={detailGift}
          lang={lang}
          tk={tk}
          inCart={cart.has(detailGift.id)}
          onAddToCart={() => {
            cart.add(detailGift);
            try {
              window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium");
            } catch {
              /* ignore */
            }
          }}
          onClose={() => setDetailGift(null)}
        />
      )}

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart.items}
        totalTon={cart.totalTon}
        onRemove={cart.remove}
        onClear={cart.clear}
        tk={tk}
      />

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

function GiftCard({ gift, lang, tk, onOpen, onAddToCart, inCart }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const mainRaster = useGiftMainRasterImage(gift);
  const { primary: cardTitle, secondary: modelLine } = giftCardTitleLines(gift);

  const rawRasterUrl = mainRaster.url;
  const imageUrl = cacheBustMediaUrl(rawRasterUrl, gift);
  const renderable = isRenderableMediaUrl(imageUrl);
  const fit = giftMediaFit(gift);
  const fitClass = fit === "cover" ? "nftCardImg--cover" : "nftCardImg--contain";
  const ogFallback = isOpenGraphMediaFallback(gift);
  const showCardImageDebug = isImageDebugEnabled();

  const portalLayersDebug = useMemo(() => resolveGiftCollectibleVisualLayers(gift), [gift]);

  const backdropSolidDebug = useMemo(() => {
    const pres = resolveCollectibleHeroPresentation(gift);
    return resolveBackdropTraitSolid(pres.backdropTheme, extractBackdropLabelFromGift(gift));
  }, [gift]);

  const backdropLabelDebug = useMemo(() => extractBackdropLabelFromGift(gift), [gift]);

  useEffect(() => {
    logGiftImageChoice("card", gift, { src: imageUrl, srcSet: undefined, heroPoster: imageUrl });
  }, [gift, imageUrl]);

  useEffect(() => {
    setImgLoaded(false);
  }, [rawRasterUrl, gift.id, mainRaster.index]);

  const showRealImage = renderable && Boolean(rawRasterUrl);
  const showSkeleton = showRealImage && !imgLoaded;
  const showFallback = !renderable || !rawRasterUrl;

  const statusLabel = listingStatusLabel(lang, gift.status);

  return (
    <article className="nftCardCell">
      <button
        type="button"
        className="nftCard nftCard--neutral nftCardOpen"
        onClick={onOpen}
        aria-label={`${gift.name}, ${gift.priceTon} TON`}
      >
        <div
          className={`nftCardMediaWrap nftCardMediaWrap--collectibleHero${ogFallback ? " nftCardMediaWrap--ogFallback" : ""}`}
          aria-busy={showSkeleton}
        >
          <div className="nftCardHeroBackdrop" aria-hidden="true">
            <GiftCollectibleHeroStage gift={gift} variant="collectibleProfile" backdropOnly surface="card" />
          </div>
          <div className="nftCardMidAtmos" aria-hidden="true">
            <div className="nftCardCollectibleBlurGlow" />
            <div className="nftCardCollectibleRadial" />
            <div className="nftCardCollectibleReadOverlay" />
          </div>
          <div className="nftCardMediaInner nftCardMediaInner--onHero">
            {showSkeleton ? <div className="nftCardImgSkel" aria-hidden="true" /> : null}
            {showRealImage ? (
              <img
                src={imageUrl}
                alt=""
                width={512}
                height={512}
                className={`nftCardImg ${fitClass} ${ogFallback ? "nftCardImg--ogFallback " : ""}${imgLoaded ? "nftCardImg--loaded" : ""}`}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                draggable={false}
                fetchPriority="low"
                onLoad={() => setImgLoaded(true)}
                onError={(e) => {
                  setImgLoaded(false);
                  const failed = e?.currentTarget?.currentSrc || e?.currentTarget?.src || imageUrl;
                  mainRaster.markFailed(failed);
                }}
              />
            ) : null}
            {showFallback ? (
              <div className="nftCardFb" role="img" aria-label={gift.name}>
                <span className="nftCardFbName">{gift.name}</span>
              </div>
            ) : null}
            {showCardImageDebug ? (
              <pre className="nftCardImageDebug mono">
                {`cardActiveImageUrl: ${rawRasterUrl || "—"}\ncardActiveImageSource: ${mainRaster.source || "—"}\ncardFailedImageUrls: ${mainRaster.failedUrls?.length ? mainRaster.failedUrls.join(", ") : "—"}\ncardImageCandidates: ${JSON.stringify(mainRaster.candidates)}\nbackdropLabel: ${backdropLabelDebug || "—"}\nbackdropLabelUsedForColor: ${backdropSolidDebug.backdropLabelUsedForColor || "—"}\nbackdropColor: ${portalLayersDebug.backdropColor}\nbackdropColorSource: ${backdropSolidDebug.backdropColorMatchPath}\nsymbolPatternUrl: ${portalLayersDebug.symbolPatternUrl || "—"}\nmodelImageUrl: ${portalLayersDebug.modelImageUrl || "—"}\nmodelAnimationUrl: ${portalLayersDebug.modelAnimationUrl || "—"}`}
              </pre>
            ) : null}
          </div>
        </div>

        <div className="nftCardMeta nftCardMeta--simple">
          <h3 className="nftCardTitle">{cardTitle}</h3>
          {modelLine ? <p className="nftCardSubline mono">{modelLine}</p> : null}
          <div className="nftCardPriceRow">
            <span className="nftCardPricePill" aria-hidden="true">
              <span className="nftCardPricePillValue">{gift.priceTon}</span>
              <span className="nftCardPricePillUnit">TON</span>
            </span>
            {statusLabel ? (
              <span className={nftStatusCardClass(gift.status)}>{statusLabel}</span>
            ) : null}
          </div>
        </div>
      </button>
      <div className="nftCardCartRow">
        <button
          type="button"
          className={`nftCardAddCart ${inCart ? "nftCardAddCart--inCart" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAddToCart();
          }}
        >
          {inCart ? tk("inCart") : tk("addToCart")}
        </button>
      </div>
    </article>
  );
}

function GiftDetailSheet({ gift, lang, tk, onClose, onAddToCart, inCart }) {
  const mainRaster = useGiftMainRasterImage(gift);
  const portalLayers = useMemo(() => resolveGiftCollectibleVisualLayers(gift), [gift]);

  const liveFloorTon = (() => {
    const r = Number(gift.realFloorTon);
    if (Number.isFinite(r) && r > 0) return r;
    const f = Number(gift.floorTon);
    return Number.isFinite(f) && f > 0 ? f : 0;
  })();

  /** @type {{ variant: "below" | "above" | "at"; pct: number } | null} */
  const floorDeltaBadge = (() => {
    const floorPrice = liveFloorTon;
    const sellerPrice = Number(gift.priceTon);
    if (!Number.isFinite(floorPrice) || floorPrice <= 0 || !Number.isFinite(sellerPrice) || sellerPrice <= 0) {
      return null;
    }
    const deltaPercent = ((floorPrice - sellerPrice) / floorPrice) * 100;
    const atFloorThresholdPct = 0.85;
    if (Math.abs(deltaPercent) <= atFloorThresholdPct) {
      return { variant: "at", pct: 0 };
    }
    const pct = Math.round(Math.abs(deltaPercent));
    if (sellerPrice < floorPrice) return { variant: "below", pct: Math.max(pct, 1) };
    return { variant: "above", pct: Math.max(pct, 1) };
  })();

  const floorDeltaBadgeLabel =
    floorDeltaBadge == null
      ? ""
      : floorDeltaBadge.variant === "at"
        ? tk("floorDeltaAtFloor")
        : floorDeltaBadge.variant === "below"
          ? tk("floorDeltaBelow").replace("{pct}", String(floorDeltaBadge.pct))
          : tk("floorDeltaAbove").replace("{pct}", String(floorDeltaBadge.pct));

  const heroPoster = cacheBustMediaUrl(mainRaster.url || portalLayers.modelImageUrl, gift);
  const staticRaster = bestStaticRasterUrl(gift);
  const mediaFit = giftMediaFit(gift);
  const ogFallback = isOpenGraphMediaFallback(gift);
  const showImageDebug = isImageDebugEnabled();
  const debugFields = showImageDebug
    ? giftImageFieldsForDebug(gift, {
        failedUrls: mainRaster.failedUrls,
        activeIndex: mainRaster.index,
        activeSource: mainRaster.source,
      })
    : null;

  const listingNo = giftListingIdDisplay(gift);
  const backdropLabel = giftBackdropLabel(gift) || "—";

  const formatTonAmount = (n) => {
    if (n == null || !Number.isFinite(Number(n)) || Number(n) <= 0) return null;
    const x = Math.round(Number(n) * 100) / 100;
    return Number.isInteger(x) ? String(x) : x.toFixed(2);
  };

  const attrRows = [
    {
      key: "model",
      label: tk("attrModel"),
      value: String(gift.model || "").trim() || "—",
      floor: traitFloorTon(gift, "model"),
      badge: traitRarityBadgeText(gift, "model"),
    },
    {
      key: "symbol",
      label: tk("attrSymbol"),
      value: String(gift.symbol || "").trim() || "—",
      floor: traitFloorTon(gift, "symbol"),
      badge: traitRarityBadgeText(gift, "symbol"),
    },
    {
      key: "backdrop",
      label: tk("attrBackdrop"),
      value: backdropLabel,
      floor: traitFloorTon(gift, "backdrop"),
      badge: traitRarityBadgeText(gift, "backdrop"),
    },
  ];

  useEffect(() => {
    logGiftImageChoice("detail", gift, { src: heroPoster, srcSet: undefined, heroPoster });
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

  return (
    <div className="nftDetailOverlay portalsDetailOverlay" role="presentation">
      <button type="button" className="nftDetailBackdrop" aria-label={tk("closeDialogAria")} onClick={onClose} />
      <div
        className="nftDetailSheet nftDetailSheet--collectibleProfile nftDetailSheet--portals"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nft-detail-title"
      >
        <div className="tgCollectibleCard">
          <div className="tgCollectibleCard__body tgCollectibleCard__body--portals">
            <div className="portalsToolbar">
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
              <div className="portalsToolbarBrand">
                <img
                  className="portalsToolbarLogo"
                  src="/quanton-logo.png"
                  alt=""
                  width={22}
                  height={22}
                  decoding="async"
                  draggable={false}
                />
                <span className="portalsToolbarTitle">{tk("portalsMarketplace")}</span>
              </div>
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

            <div className="tgCollectibleHero tgCollectibleHero--portalsSlot">
              <div className="tgCollectibleHero__backdrop" aria-hidden="true">
                <GiftCollectibleHeroStage gift={gift} variant="collectibleProfile" backdropOnly />
              </div>
              <div className={`tgCollectibleHeroImg${ogFallback ? " tgCollectibleHeroImg--ogFallback" : ""}`}>
                <GiftAnimatedHero
                  animationUrl={portalLayers.modelAnimationUrl}
                  posterUrl={heroPoster}
                  alt={gift.name}
                  mediaFit={mediaFit}
                  onRasterError={(failed) => mainRaster.markFailed(failed)}
                />
              </div>
              <div className="portalsTitleBlock">
                <h2 id="nft-detail-title" className="portalsTitle">
                  {gift.name}
                </h2>
              </div>
            </div>

            {gift.imageUpscaleStatus === "pending" ? (
              <p className="portalsUpscalingNote mono">{tk("badgeUpscalingDetail")}</p>
            ) : null}

            <div className="portalsSheetFlow">
              <section className="portalsGlassSection portalsGlassSection--traitTable">
                <div className="portalsAttrList" role="list">
                  {attrRows.map((row) => (
                    <div key={row.key} className="portalsAttrRow" role="listitem">
                      <span className="portalsAttrRow__label">{row.label}</span>
                      <div className="portalsAttrRow__center">
                        <span className="portalsAttrRow__value">{row.value}</span>
                        {row.badge ? <span className="portalsRarityPill mono">{row.badge}</span> : null}
                      </div>
                      <span className="portalsAttrRow__floor mono">
                        {formatTonAmount(row.floor) ? `${formatTonAmount(row.floor)} TON` : "—"}
                      </span>
                    </div>
                  ))}
                  <div className="portalsAttrRow portalsAttrRow--floor" role="listitem">
                    <span className="portalsAttrRow__label">{tk("portalsReferenceFloor")}</span>
                    <div className="portalsAttrRow__center">
                      <span className="portalsAttrRow__value portalsAttrRow__value--floor mono">
                        {formatTonAmount(liveFloorTon) ? `${formatTonAmount(liveFloorTon)} TON` : "—"}
                      </span>
                    </div>
                    <span className="portalsAttrRow__floor mono" />
                  </div>
                </div>
              </section>

              <div className="portalsActionsRow">
                <button type="button" className="portalsBtnOffer" disabled>
                  <span className="portalsBtnOffer__label">{tk("portalsMakeOffer")}</span>
                  <span className="portalsBtnOffer__hint mono">{tk("portalsOfferHint")}</span>
                </button>
                <div className="portalsBtnFloor" aria-label={tk("portalsReferenceFloor")}>
                  <span className="portalsBtnFloor__label">{tk("portalsReferenceFloor")}</span>
                  <span className="portalsBtnFloor__value mono">
                    {formatTonAmount(liveFloorTon) ? `${formatTonAmount(liveFloorTon)} TON` : "—"}
                  </span>
                </div>
                <button type="button" className={`portalsBtnCart ${inCart ? "portalsBtnCart--inCart" : ""}`} onClick={onAddToCart}>
                  <span className="portalsBtnCart__label">{inCart ? tk("inCart") : tk("addToCart")}</span>
                  <span className="portalsBtnCart__price mono">
                    {formatTonAmount(gift.priceTon) ? `${formatTonAmount(gift.priceTon)} TON` : "—"}
                  </span>
                </button>
              </div>

              {floorDeltaBadge ? (
                <span
                  className={`portalsFloorDeltaBadge portalsFloorDeltaBadge--${floorDeltaBadge.variant}`}
                  aria-label={floorDeltaBadgeLabel}
                >
                  {floorDeltaBadgeLabel}
                </span>
              ) : null}

              <p className="portalsTrustFooter">{tk("portalsTrustFooter")}</p>

              {showImageDebug && debugFields ? (
                <section
                  className="portalsGlassSection portalsDebugSection"
                  style={{ borderStyle: "dashed" }}
                >
                  <h3 className="portalsSectionTitle" style={{ color: "#fbbf24" }}>
                    Image debug (original vs upscaled)
                  </h3>
                  <p className="mono" style={{ fontSize: 11, opacity: 0.85, margin: "0 0 8px" }}>
                    Enable with <code>?imageDebug=1</code> or{" "}
                    <code>localStorage.setItem(&quot;quantonImageDebug&quot;,&quot;1&quot;)</code>
                  </p>
                  <div style={{ display: "grid", gap: 10, fontSize: 11 }}>
                    <pre className="mono" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                      {JSON.stringify(debugFields, null, 2).length > 12_000
                        ? "debug payload large — use browser devtools"
                        : JSON.stringify(debugFields, null, 2)}
                    </pre>
                  </div>
                </section>
              ) : null}

              {(gift.sellerNote || gift.giftLink) && (
                <section className="portalsGlassSection">
                  <h3 className="portalsSectionTitle">{tk("detailSectionContext")}</h3>
                  {gift.sellerNote ? (
                    <p className="nftDetailNarrative">
                      <strong>{tk("detailSellerNote")}:</strong> {gift.sellerNote}
                    </p>
                  ) : null}
                  {gift.giftLink ? (
                    <a
                      className="nftDetailLink mono"
                      href={gift.giftLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
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

function CartDrawer({ open, onClose, items, totalTon, onRemove, onClear, tk }) {
  if (!open) return null;

  const rounded = Math.round(Number(totalTon) * 100) / 100;
  const totalStr = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);

  return (
    <div className="cartOverlay" role="presentation">
      <button type="button" className="cartBackdrop" aria-label={tk("closeDialogAria")} onClick={onClose} />
      <div
        className="cartSheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
      >
        <header className="cartSheet__header">
          <h2 id="cart-drawer-title" className="cartSheet__title">
            {tk("cartTitle")}
          </h2>
          <button type="button" className="cartSheet__close" onClick={onClose} aria-label={tk("closeDialogAria")}>
            ×
          </button>
        </header>
        <div className="cartSheet__body">
          {items.length === 0 ? (
            <p className="cartSheet__empty mono">{tk("cartEmpty")}</p>
          ) : (
            <ul className="cartList">
              {items.map((g) => (
                <li key={g.id} className="cartRow">
                  <div className="cartRow__thumbWrap">
                    {g.image ? (
                      <img src={g.image} alt="" className="cartRow__thumb" width={48} height={48} />
                    ) : (
                      <div className="cartRow__thumb cartRow__thumb--fb" aria-hidden="true" />
                    )}
                  </div>
                  <div className="cartRow__meta">
                    <span className="cartRow__name">{g.name}</span>
                    <span className="cartRow__price mono">
                      {g.priceTon} TON
                    </span>
                  </div>
                  <button
                    type="button"
                    className="cartRow__remove mono"
                    onClick={() => onRemove(g.id)}
                  >
                    {tk("cartRemove")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer className="cartSheet__footer">
          <div className="cartTotal mono">
            <span>{tk("cartTotal")}</span>
            <strong>
              {totalStr} TON
            </strong>
          </div>
          <div className="cartFooterActions">
            <button type="button" className="cartBtnSecondary" onClick={onClear} disabled={items.length === 0}>
              {tk("cartClear")}
            </button>
            <button type="button" className="cartBtnPrimary" disabled>
              {tk("cartCheckout")}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
