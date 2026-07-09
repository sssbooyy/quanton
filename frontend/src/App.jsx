import { useEffect, useMemo, useState } from "react";
import { TonConnectButton, useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { beginCell, toNano } from "@ton/core";
import {
  addGift,
  createOrder,
  getGifts,
  getTonUzsRate,
  submitManualPayment,
  submitOrderPayment,
  verifyOrderPayment,
} from "./api";
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
import { giftMatchesSearch } from "./marketplaceBrowse.js";
import { useMarketplaceCart } from "./useMarketplaceCart.js";
import {
  CURRENCIES,
  CURRENCY_STORAGE_KEY,
  formatMarketplacePrice,
  formatTonPrice,
  formatUzsPrice,
} from "./currency.js";
import {
  extractBackdropLabelFromGift,
  resolveBackdropTraitSolid,
  resolveCollectibleHeroPresentation,
} from "@shared/giftHeroResolve.js";
import BottomNav from "./components/BottomNav.jsx";
import TabPlaceholder from "./pages/TabPlaceholder.jsx";
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

const MANUAL_LISTING_FALLBACK_ENABLED =
  import.meta.env.VITE_ENABLE_MANUAL_LISTING_FALLBACK === "true" ||
  import.meta.env.VITE_ENABLE_MANUAL_LISTING === "true" ||
  (import.meta.env.VITE_ENABLE_MANUAL_LISTING_FALLBACK !== "false" &&
    import.meta.env.VITE_ENABLE_MANUAL_LISTING !== "false");

const PAYME_QR_IMAGE_URL = String(import.meta.env.VITE_PAYME_QR_IMAGE_URL || "").trim();
const PAYME_CARD_LABEL = String(import.meta.env.VITE_PAYME_CARD_LABEL || "").trim();
const PAYME_RECEIVER_NAME = String(import.meta.env.VITE_PAYME_RECEIVER_NAME || "").trim();

function getTelegramUser() {
  try {
    return window.Telegram?.WebApp?.initDataUnsafe?.user ?? null;
  } catch {
    return null;
  }
}

function tonCommentPayload(comment) {
  const boc = beginCell().storeUint(0, 32).storeStringTail(String(comment || "")).endCell().toBoc();
  let binary = "";
  for (const byte of boc) binary += String.fromCharCode(byte);
  return window.btoa(binary);
}

function checkoutStatusText(status) {
  switch (status) {
    case "wallet_required":
      return "Connect wallet to checkout.";
    case "creating_order":
      return "Creating order...";
    case "wallet_confirmation":
      return "Confirm transaction in your wallet.";
    case "transaction_sent":
      return "Transaction sent. Submitting payment claim...";
    case "awaiting_admin_confirmation":
      return "Payment sent. Waiting for admin confirmation.";
    case "manual_payment_submitted":
      return "Payment submitted. Waiting for admin confirmation.";
    case "payme_checkout":
      return "Complete Payme payment in the modal.";
    case "payment_submitted":
      return "Payment submitted. Admin will confirm shortly.";
    case "verifying_payment":
      return "Verifying payment on TON...";
    case "opening_card_payment":
      return "Opening card checkout...";
    case "card_pending":
      return "Waiting for card payment...";
    case "confirmed":
      return "Payment confirmed. Listings refreshed.";
    case "failed":
      return "Payment failed. Please try again.";
    default:
      return "";
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
  if (status === "approved" || status === "listed") return "nftCardStatus nftCardStatus--approved";
  return "nftCardStatus";
}

function giftIsBuyable(gift) {
  const status = String(gift?.status || "").toLowerCase();
  const source = String(gift?.listingSource || "manual_url");
  if (source === "manual_admin_verified") {
    return status === "listed" && String(gift?.verificationStatus || "") === "admin_verified";
  }
  return (
    status === "approved" &&
    (source === "manual_url" || String(gift?.escrowStatus || "").toLowerCase() === "listed")
  );
}

export default function App() {
  const [lang, setLang] = useState(getInitialLanguage);
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const cart = useMarketplaceCart();
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  const [giftForm, setGiftForm] = useState(emptyGiftForm);
  const [giftSubmitting, setGiftSubmitting] = useState(false);
  const [giftFormError, setGiftFormError] = useState(null);
  const [successToast, setSuccessToast] = useState(null);
  const [detailGift, setDetailGift] = useState(null);
  const [tonConnectUI] = useTonConnectUI();
  const walletAddress = useTonAddress();
  const [checkoutState, setCheckoutState] = useState({ status: "idle", error: "", orderId: "" });
  const [paymentMethod, setPaymentMethod] = useState({ type: "ton", provider: "" });
  const [paymeManualPayment, setPaymeManualPayment] = useState(null);
  const [paymeSubmitting, setPaymeSubmitting] = useState(false);
  const [currency, setCurrency] = useState(() => {
    try {
      return window.localStorage.getItem(CURRENCY_STORAGE_KEY) === CURRENCIES.UZS ? CURRENCIES.UZS : CURRENCIES.TON;
    } catch {
      return CURRENCIES.TON;
    }
  });
  const [tonUzsRate, setTonUzsRate] = useState(() => {
    try {
      const cached = JSON.parse(window.localStorage.getItem("quanton_ton_uzs_rate_v1") || "null");
      return Number(cached?.tonUzs) > 0 ? Number(cached.tonUzs) : 0;
    } catch {
      return 0;
    }
  });
  const [tonUzsRateLoading, setTonUzsRateLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("market");

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

  const anyModalOpen = giftModalOpen || Boolean(detailGift) || cartOpen || Boolean(paymeManualPayment);

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
      if (paymeManualPayment) {
        setPaymeManualPayment(null);
        return;
      }
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
  }, [anyModalOpen, giftModalOpen, cartOpen, paymeManualPayment]);

  useEffect(() => {
    if (!successToast) return;
    const timer = setTimeout(() => setSuccessToast(null), 4500);
    return () => clearTimeout(timer);
  }, [successToast]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
    } catch {
      /* ignore */
    }
  }, [currency]);

  async function refreshTonUzsRate() {
    setTonUzsRateLoading(true);
    try {
      const data = await getTonUzsRate();
      const rate = Number(data?.tonUzs);
      if (Number.isFinite(rate) && rate > 0) {
        setTonUzsRate(rate);
        try {
          window.localStorage.setItem("quanton_ton_uzs_rate_v1", JSON.stringify(data));
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      console.warn("[rates] ton-uzs unavailable", err?.message || err);
    } finally {
      setTonUzsRateLoading(false);
    }
  }

  useEffect(() => {
    refreshTonUzsRate();
  }, []);

  useEffect(() => {
    console.info("[currency]", {
      selectedCurrency: currency,
      tonUzsRate,
      displayPrice: formatMarketplacePrice(1, currency, tonUzsRate),
      rateLoading: tonUzsRateLoading,
    });
  }, [currency, tonUzsRate, tonUzsRateLoading]);

  const displayPrice = useMemo(
    () => (tonAmount) => {
      if (currency === CURRENCIES.UZS && !tonUzsRate) {
        return "…";
      }
      return formatMarketplacePrice(tonAmount, currency, tonUzsRate);
    },
    [currency, tonUzsRate, tonUzsRateLoading],
  );

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

  async function handleCheckout() {
    if (cart.items.length === 0) return;
    setCheckoutState({ status: "idle", error: "", orderId: "" });

    if (paymentMethod.type === "ton" && !walletAddress) {
      setCheckoutState({ status: "wallet_required", error: "", orderId: "" });
      try {
        await tonConnectUI.openModal();
      } catch {
        /* wallet modal may be closed by the user */
      }
      return;
    }

    const tgUser = getTelegramUser();
    let currentOrderId = "";
    try {
      setCheckoutState({ status: "creating_order", error: "", orderId: "" });
      const order = await createOrder({
        listingIds: cart.items.map((g) => g.id),
        buyerTelegramId: tgUser?.id ? String(tgUser.id) : "",
        buyerUsername: tgUser?.username ? String(tgUser.username) : "",
        telegramUser: tgUser || undefined,
        buyerWalletAddress: paymentMethod.type === "ton" ? walletAddress : "",
        paymentMethod: paymentMethod.type,
        cardProvider: paymentMethod.provider,
      });
      currentOrderId = order.orderId;
      const marketplaceWalletAddress = String(order.marketplaceWalletAddress || "").trim();
      const orderPayload = String(order.payload || order.comment || order.orderId || "").trim();
      const orderTotalTon = Number(order.totalTon);

      console.log("[checkout] order payment details", {
        orderId: order.orderId,
        marketplaceWalletAddress,
        totalTon: orderTotalTon,
        payload: orderPayload,
      });

      if (paymentMethod.type === "payme_manual") {
        setCheckoutState({ status: "payme_checkout", error: "", orderId: order.orderId });
        setPaymeManualPayment({
          order,
          orderId: order.orderId,
          amountUzs: Number(order.amountUzs || order.totalUzs) || 0,
        });
        setCartOpen(false);
        return;
      }

      if (!marketplaceWalletAddress) {
        setCheckoutState({
          status: "failed",
          error: "Marketplace wallet address is missing. Please try again later.",
          orderId: order.orderId,
        });
        return;
      }
      if (!Number.isFinite(orderTotalTon) || orderTotalTon <= 0) {
        setCheckoutState({
          status: "failed",
          error: "Order total is invalid. Please refresh and try again.",
          orderId: order.orderId,
        });
        return;
      }

      setCheckoutState({ status: "wallet_confirmation", error: "", orderId: order.orderId });
      const txResult = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: marketplaceWalletAddress,
            amount: toNano(String(orderTotalTon)).toString(),
            payload: tonCommentPayload(orderPayload),
          },
        ],
      });

      setCheckoutState({ status: "transaction_sent", error: "", orderId: order.orderId });
      const txHash = String(txResult?.boc || txResult?.hash || "").trim();
      const walletAppInfo = String(tonConnectUI?.wallet?.device?.appName || tonConnectUI?.wallet?.name || "").trim();
      await submitOrderPayment(order.orderId, {
        buyerWalletAddress: walletAddress,
        buyerTelegramId: tgUser?.id ? String(tgUser.id) : "",
        buyerUsername: tgUser?.username ? String(tgUser.username) : "",
        telegramUser: tgUser || undefined,
        txHash,
        walletAppInfo,
      });

      setCheckoutState({
        status: "awaiting_admin_confirmation",
        error: "",
        orderId: order.orderId,
      });
      setSuccessToast(`Payment submitted. Order ${order.orderId}. Admin will confirm shortly.`);
    } catch (error) {
      console.error(error);
      const msg =
        error.response?.data?.error ||
        error.message ||
        "Payment failed. Please try again.";
      setCheckoutState({
        status: "failed",
        error: typeof msg === "string" ? translateServerMessage(lang, msg) : "Payment failed. Please try again.",
        orderId: currentOrderId,
      });
    }
  }

  async function handlePaymeManualPaid() {
    if (!paymeManualPayment?.orderId) return;
    const tgUser = getTelegramUser();
    const amountUzs = Number(paymeManualPayment.amountUzs) || 0;
    try {
      setPaymeSubmitting(true);
      await submitManualPayment(paymeManualPayment.orderId, {
        paymentMethod: "payme_manual",
        amountUzs,
        buyerTelegramId: tgUser?.id ? String(tgUser.id) : "",
        buyerUsername: tgUser?.username ? String(tgUser.username) : "",
        telegramUser: tgUser || undefined,
      });
      setCheckoutState({
        status: "manual_payment_submitted",
        error: "",
        orderId: paymeManualPayment.orderId,
      });
      setPaymeManualPayment(null);
      setSuccessToast("Payment submitted. Waiting for admin confirmation.");
    } catch (error) {
      console.error(error);
      const msg =
        error.response?.data?.error ||
        error.message ||
        "Could not submit payment claim. Please try again.";
      setCheckoutState((prev) => ({
        ...prev,
        status: "failed",
        error: typeof msg === "string" ? translateServerMessage(lang, msg) : "Could not submit payment claim.",
        orderId: paymeManualPayment.orderId,
      }));
    } finally {
      setPaymeSubmitting(false);
    }
  }

  const filteredGifts = useMemo(
    () => gifts.filter((gift) => giftMatchesSearch(gift, searchQuery)),
    [gifts, searchQuery],
  );

  return (
    <div className="shell shell--miniapp shell--withNav">
      {successToast && (
        <div className="successToast" role="status" aria-live="polite">
          {successToast}
        </div>
      )}

      {activeTab === "activity" ? (
        <TabPlaceholder
          title="Activity coming soon"
          subtitle="Listings, sales, and price changes will appear here."
          variant="activity"
        />
      ) : null}
      {activeTab === "profile" ? (
        <TabPlaceholder
          title="Profile"
          subtitle="Wallet, seller stats, purchase history, and listings are coming soon."
          variant="profile"
        />
      ) : null}

      {activeTab === "market" ? (
        <>
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
            <span className="brandQuanton">Quanton Marketplace</span>
          </div>
        </div>
        <div className="topbarRight">
          <div className="tonConnectSlot tonConnectSlot--header">
            <TonConnectButton />
          </div>
          <div className="currencyToggle" role="group" aria-label="Currency">
            {[CURRENCIES.TON, CURRENCIES.UZS].map((c) => (
              <button
                key={c}
                type="button"
                className={currency === c ? "active" : ""}
                onClick={() => {
                  setCurrency(c);
                  if (c === CURRENCIES.UZS && !tonUzsRate && !tonUzsRateLoading) {
                    refreshTonUzsRate();
                  }
                }}
              >
                {c}
              </button>
            ))}
          </div>
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
        <div className="marketSearchWrap">
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
                displayPrice={displayPrice}
                tonUzsRate={tonUzsRate}
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
          displayPrice={displayPrice}
          displayCurrency={currency}
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
        onCheckout={handleCheckout}
        checkoutState={checkoutState}
        walletAddress={walletAddress}
        paymentMethod={paymentMethod}
        onPaymentMethodChange={setPaymentMethod}
        displayPrice={displayPrice}
        displayCurrency={currency}
        tk={tk}
      />

      {paymeManualPayment ? (
        <PaymeManualPaymentModal
          payment={paymeManualPayment}
          submitting={paymeSubmitting}
          onClose={() => setPaymeManualPayment(null)}
          onPaid={handlePaymeManualPaid}
        />
      ) : null}
        </>
      ) : null}

      {activeTab === "market" && MANUAL_LISTING_FALLBACK_ENABLED && giftModalOpen && (
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

      <BottomNav active={activeTab} onChange={setActiveTab} />
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

function GiftCard({ gift, lang, tk, displayPrice, tonUzsRate, onOpen, onAddToCart, inCart }) {
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
  const isBuyable = giftIsBuyable(gift);
  const tonPrice = Number(gift?.priceTon);
  const uzsEq =
    Number.isFinite(tonPrice) && tonPrice > 0 && Number.isFinite(tonUzsRate) && tonUzsRate > 0
      ? formatUzsPrice(tonPrice * tonUzsRate)
      : "";
  const floorTon = Number(gift?.realFloorTon) > 0 ? Number(gift.realFloorTon) : Number(gift?.floorTon);
  const floorGapPct =
    Number.isFinite(floorTon) && floorTon > 0 && Number.isFinite(tonPrice) && tonPrice > 0
      ? Math.round(((floorTon - tonPrice) / floorTon) * 100)
      : null;

  return (
    <article className="nftCardCell">
      <button
        type="button"
        className="nftCard nftCard--neutral nftCardOpen"
        onClick={onOpen}
        aria-label={`${gift.name}, ${displayPrice(gift.priceTon)}`}
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
      </button>
      <div className="nftCardMeta nftCardMeta--simple">
        <button
          type="button"
          className="nftCardTitleOpen"
          onClick={onOpen}
          aria-label={`${gift.name}, ${displayPrice(gift.priceTon)}`}
        >
          <h3 className="nftCardTitle">{cardTitle}</h3>
          <p className="nftCardSubline mono">
            {modelLine || gift.collection || "Collection"} {gift?.giftNumber ? `• #${gift.giftNumber}` : ""}
          </p>
        </button>
        <div className="nftCardPriceRow">
          <span className="nftCardPricePill" aria-hidden="true">
            <span className="nftCardPricePillValue">{displayPrice(gift.priceTon)}</span>
          </span>
          <span className="nftCardPriceSub mono">{uzsEq}</span>
          {statusLabel ? (
            <span className={nftStatusCardClass(gift.status)}>{statusLabel}</span>
          ) : null}
          {floorGapPct !== null ? (
            <span className={`nftCardFloorGap mono ${floorGapPct >= 0 ? "nftCardFloorGap--below" : "nftCardFloorGap--above"}`}>
              {floorGapPct >= 0 ? `${floorGapPct}% below floor` : `${Math.abs(floorGapPct)}% above floor`}
            </span>
          ) : null}
        </div>
      </div>
      <div className="nftCardCartRow">
        <button
          type="button"
          className={`nftCardAddCart ${inCart ? "nftCardAddCart--inCart" : ""}`}
          disabled={!isBuyable}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isBuyable) return;
            onAddToCart();
          }}
        >
          {isBuyable ? (inCart ? tk("inCart") : tk("addToCart")) : statusLabel || tk("statusPending")}
        </button>
      </div>
    </article>
  );
}

function GiftDetailSheet({ gift, lang, tk, displayPrice, displayCurrency, onClose, onAddToCart, inCart }) {
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
  const isBuyable = giftIsBuyable(gift);
  const statusLabel = listingStatusLabel(lang, gift.status);

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
                        {displayPrice(row.floor)}
                      </span>
                    </div>
                  ))}
                  <div className="portalsAttrRow portalsAttrRow--floor" role="listitem">
                    <span className="portalsAttrRow__label">{tk("portalsReferenceFloor")}</span>
                    <div className="portalsAttrRow__center">
                      <span className="portalsAttrRow__value portalsAttrRow__value--floor mono">
                        {displayPrice(liveFloorTon)}
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
                    {displayPrice(liveFloorTon)}
                  </span>
                </div>
                <button
                  type="button"
                  className={`portalsBtnCart ${inCart ? "portalsBtnCart--inCart" : ""}`}
                  onClick={() => {
                    if (isBuyable) onAddToCart();
                  }}
                  disabled={!isBuyable}
                >
                  <span className="portalsBtnCart__label">{isBuyable ? (inCart ? tk("inCart") : tk("addToCart")) : statusLabel || tk("statusPending")}</span>
                  <span className="portalsBtnCart__price mono">
                    {displayPrice(gift.priceTon)}
                  </span>
                  {displayCurrency === CURRENCIES.UZS ? (
                    <span className="portalsBtnCart__price mono">{formatTonPrice(gift.priceTon)} payment</span>
                  ) : null}
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

function CartDrawer({
  open,
  onClose,
  items,
  totalTon,
  onRemove,
  onClear,
  onCheckout,
  checkoutState,
  walletAddress,
  paymentMethod,
  onPaymentMethodChange,
  displayPrice,
  displayCurrency,
  tk,
}) {
  if (!open) return null;

  const totalStr = formatTonPrice(totalTon);
  const checkoutBusy = [
    "creating_order",
    "wallet_confirmation",
    "transaction_sent",
    "verifying_payment",
    "awaiting_admin_confirmation",
    "manual_payment_submitted",
    "payme_checkout",
  ].includes(checkoutState?.status);

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
          <div className="cartWalletPanel">
            <div>
              <p className="cartWalletPanel__label">TON wallet</p>
              <p className="cartWalletPanel__value mono">
                {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-6)}` : "Not connected"}
              </p>
            </div>
            <div className="tonConnectSlot tonConnectSlot--cart">
              <TonConnectButton />
            </div>
          </div>
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
                      {displayPrice(g.priceTon)}
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
              {displayPrice(totalTon)}
            </strong>
          </div>
          {displayCurrency === CURRENCIES.UZS ? (
            <div className="cartTotal cartTotal--payment mono">
              <span>Payment</span>
              <strong>{totalStr}</strong>
            </div>
          ) : null}
          <div className="cartCheckoutPanel">
            <div className="cartCheckoutPanel__head">
              <span>Checkout</span>
              <span
                className={
                  paymentMethod.type === "ton"
                    ? walletAddress
                      ? "text-bull"
                      : "text-muted"
                    : "text-bull"
                }
              >
                {paymentMethod.type === "ton"
                  ? walletAddress
                    ? "Wallet connected"
                    : "Wallet required"
                  : "Payme QR"}
              </span>
            </div>
            <div className="paymentMethodList" role="radiogroup" aria-label="Payment method">
              <button
                type="button"
                className={paymentMethod.type === "ton" ? "paymentMethod active" : "paymentMethod"}
                onClick={() => onPaymentMethodChange({ type: "ton", provider: "" })}
              >
                <span>TON</span>
                <small>TON Connect</small>
              </button>
              <button
                type="button"
                className={paymentMethod.type === "payme_manual" ? "paymentMethod active" : "paymentMethod"}
                onClick={() => onPaymentMethodChange({ type: "payme_manual", provider: "" })}
              >
                <span>Payme QR</span>
                <small>UZS transfer</small>
              </button>
            </div>
            <div className="tonConnectSlot tonConnectSlot--checkout">
              {paymentMethod.type === "ton" ? <TonConnectButton /> : null}
            </div>
            {checkoutState?.status && checkoutState.status !== "idle" ? (
              <p className={`cartCheckoutStatus mono cartCheckoutStatus--${checkoutState.status}`}>
                {checkoutState.error || checkoutStatusText(checkoutState.status)}
              </p>
            ) : null}
            {(checkoutState?.orderId &&
              (checkoutState.status === "awaiting_admin_confirmation" ||
                checkoutState.status === "manual_payment_submitted")) ? (
              <p className="cartCheckoutStatus mono">Order ID: {checkoutState.orderId}</p>
            ) : null}
          </div>
          <div className="cartFooterActions">
            <button type="button" className="cartBtnSecondary" onClick={onClear} disabled={items.length === 0}>
              {tk("cartClear")}
            </button>
            <button
              type="button"
              className="cartBtnPrimary"
              onClick={onCheckout}
              disabled={items.length === 0 || checkoutBusy || (paymentMethod.type === "ton" && !walletAddress)}
            >
              {tk("cartCheckout")}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function PaymeManualPaymentModal({ payment, submitting, onClose, onPaid }) {
  const order = payment?.order || {};
  const amountUzs = Number(payment?.amountUzs || order.amountUzs || order.totalUzs) || 0;

  return (
    <div className="paymentTestOverlay" role="presentation">
      <button type="button" className="cartBackdrop" aria-label="Close payment" onClick={onClose} />
      <div className="paymentTestSheet paymeManualSheet" role="dialog" aria-modal="true" aria-labelledby="payme-manual-title">
        <header className="paymentTestHeader">
          <div>
            <p className="paymentTestKicker mono">PAYME QR</p>
            <h2 id="payme-manual-title">Pay with Payme</h2>
          </div>
          <button type="button" className="cartSheet__close" onClick={onClose} aria-label="Close payment">
            ×
          </button>
        </header>
        <div className="paymentTestBody">
          {PAYME_QR_IMAGE_URL ? (
            <div className="paymeManualQrWrap">
              <img src={PAYME_QR_IMAGE_URL} alt="Payme QR code" className="paymeManualQr" />
            </div>
          ) : (
            <p className="paymentTestNote mono">Payme QR image is not configured.</p>
          )}
          {PAYME_CARD_LABEL ? (
            <div className="paymentTestRow mono">
              <span>Card</span>
              <strong>{PAYME_CARD_LABEL}</strong>
            </div>
          ) : null}
          {PAYME_RECEIVER_NAME ? (
            <div className="paymentTestRow mono">
              <span>Receiver</span>
              <strong>{PAYME_RECEIVER_NAME}</strong>
            </div>
          ) : null}
          <div className="paymentTestRow mono">
            <span>Amount UZS</span>
            <strong>{formatUzsPrice(amountUzs)}</strong>
          </div>
          <div className="paymentTestRow mono">
            <span>Order ID</span>
            <strong>{order.orderId || payment?.orderId}</strong>
          </div>
          <p className="paymentTestNote">
            Pay this exact amount via Payme. After payment, press I Paid.
          </p>
          <button type="button" className="cartBtnPrimary paymeManualPaidBtn" onClick={onPaid} disabled={submitting}>
            {submitting ? "Submitting…" : "I Paid"}
          </button>
        </div>
      </div>
    </div>
  );
}
