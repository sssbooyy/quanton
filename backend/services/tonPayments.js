import axios from "axios";
import { Address } from "@ton/core";
import { MARKETPLACE_WALLET_ADDRESS, TON_API_KEY } from "../config.js";

const TONAPI_BASE_URL = "https://tonapi.io/v2";

export function sanitizeTonAddressEnv(raw) {
  return String(raw ?? "")
    .trim()
    .replace(/^['"`]+|['"`]+$/g, "")
    .replace(/[\r\n\t\u200b\u200c\u200d\ufeff\u00a0]/g, "")
    .replace(/\s+/g, "");
}

function addressShapeChecks(address) {
  const s = String(address || "");
  return {
    length: s.length,
    looksFriendly: Address.isFriendly(s),
    looksRaw: Address.isRaw(s),
    looksBase64Url: /^[EUk0]?Q[A-Za-z0-9_-]{46,}$/.test(s),
    looksHex64: /^[0-9a-fA-F]{64}$/.test(s),
    hasQuoteChars: /['"`]/.test(s),
    hasWhitespace: /\s/.test(s),
    hasControlChars: /[\r\n\t]/.test(s),
  };
}

/**
 * @ton/core 0.63 exposes Address.parse, not parseSafe — guard parse failures here.
 */
export function parseTonAddressSafe(source) {
  const cleaned = sanitizeTonAddressEnv(source);
  if (!cleaned) return null;
  if (typeof Address.parseSafe === "function") {
    return Address.parseSafe(cleaned);
  }
  try {
    return Address.parse(cleaned);
  } catch {
    return null;
  }
}

export function validateMarketplaceWallet(raw = MARKETPLACE_WALLET_ADDRESS) {
  const trimmed = sanitizeTonAddressEnv(raw);
  const shape = addressShapeChecks(trimmed);

  console.log("[ton] MARKETPLACE_WALLET_ADDRESS", {
    configured: Boolean(raw),
    trimmed,
    ...shape,
    tonApiKeyConfigured: Boolean(TON_API_KEY),
  });

  if (!trimmed) {
    console.error("[ton] INVALID_MARKETPLACE_WALLET_ADDRESS", { reason: "empty_after_trim" });
    return {
      error: "MARKETPLACE_WALLET_ADDRESS is not configured.",
      code: "INVALID_MARKETPLACE_WALLET_ADDRESS",
    };
  }

  const parsed = parseTonAddressSafe(trimmed);
  if (!parsed) {
    console.error("[ton] INVALID_MARKETPLACE_WALLET_ADDRESS", {
      trimmed,
      ...shape,
      hint: "Use a valid EQ/UQ friendly address or 0:<64-hex> raw address without quotes, spaces, or line breaks.",
    });
    return {
      error:
        "MARKETPLACE_WALLET_ADDRESS is invalid. Remove quotes, spaces, and line breaks from the env value.",
      code: "INVALID_MARKETPLACE_WALLET_ADDRESS",
    };
  }

  let bounceable = true;
  let testOnly = false;
  let format = "raw";
  if (Address.isFriendly(trimmed)) {
    const friendly = Address.parseFriendly(trimmed);
    bounceable = friendly.isBounceable;
    testOnly = friendly.isTestOnly;
    format = "friendly";
  }

  const rawAddress = parsed.toRawString();
  const friendlyAddress = Address.isFriendly(trimmed)
    ? trimmed
    : parsed.toString({ bounceable: true, testOnly, urlSafe: true });

  console.log("[ton] MARKETPLACE_WALLET_ADDRESS_OK", {
    format,
    bounceable,
    testOnly,
    workchain: parsed.workChain,
    rawAddress,
    friendlyAddress,
  });

  return {
    trimmed,
    parsed,
    rawAddress,
    friendlyAddress,
    bounceable,
    testOnly,
    workchain: parsed.workChain,
  };
}

export function normalizeTonAddress(address) {
  const parsed = parseTonAddressSafe(address);
  if (parsed) return parsed.toRawString().toLowerCase();
  return sanitizeTonAddressEnv(address).toLowerCase();
}

export function tonToNanoString(value) {
  const s = String(value ?? "").trim();
  if (!/^\d+(\.\d+)?$/.test(s)) return "0";
  const [whole, frac = ""] = s.split(".");
  const nano = `${whole}${frac.padEnd(9, "0").slice(0, 9)}`.replace(/^0+(?=\d)/, "");
  return nano || "0";
}

function extractTxHash(tx) {
  return String(tx?.hash || tx?.transaction_id?.hash || tx?.transactionId?.hash || "").trim();
}

function extractTxUtime(tx) {
  const n = Number(tx?.utime ?? tx?.now ?? tx?.timestamp);
  return Number.isFinite(n) ? n : 0;
}

function extractIncomingMessage(tx) {
  return tx?.in_msg || tx?.inMsg || tx?.inMessage || null;
}

function extractDestination(msg) {
  const dst = msg?.destination || msg?.dest || msg?.to;
  if (typeof dst === "string") return dst;
  return String(dst?.address || dst?.account?.address || "").trim();
}

function extractSource(msg) {
  const src = msg?.source || msg?.src || msg?.from;
  if (typeof src === "string") return src;
  return String(src?.address || src?.account?.address || "").trim();
}

function extractValueNano(msg) {
  const raw = msg?.value ?? msg?.amount ?? msg?.ihr_fee;
  try {
    return BigInt(String(raw ?? "0"));
  } catch {
    return 0n;
  }
}

function readTextDeep(v, seen = new Set()) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v !== "object") return "";
  if (seen.has(v)) return "";
  seen.add(v);

  for (const key of ["text", "comment", "message", "payload", "body", "value"]) {
    if (typeof v[key] === "string" && v[key].trim()) return v[key];
  }
  for (const val of Object.values(v)) {
    const found = readTextDeep(val, seen);
    if (found) return found;
  }
  return "";
}

function extractComment(msg) {
  return readTextDeep({
    decoded_body: msg?.decoded_body,
    decodedBody: msg?.decodedBody,
    message_content: msg?.message_content,
    messageContent: msg?.messageContent,
    comment: msg?.comment,
    body: msg?.body,
  });
}

export async function findMatchingIncomingPayment(order) {
  const wallet = validateMarketplaceWallet();
  if (wallet.error) {
    return { error: wallet.error, code: wallet.code };
  }
  if (!TON_API_KEY) {
    return { error: "TON_API_KEY is not configured.", code: "TON_API_KEY_MISSING" };
  }

  const rawAddress = wallet.rawAddress;
  const friendlyAddress = wallet.friendlyAddress;
  const finalAccountId = friendlyAddress;
  const finalUrlPath = `/blockchain/accounts/${finalAccountId}/transactions`;
  const url = `${TONAPI_BASE_URL}${finalUrlPath}`;

  console.log("[ton] TonAPI verification request", {
    orderId: order?.orderId,
    rawAddress,
    friendlyAddress,
    finalAccountId,
    finalUrlPath,
    addressLength: finalAccountId.length,
    bounceable: wallet.bounceable,
    testOnly: wallet.testOnly,
    workchain: wallet.workchain,
  });

  let res;
  try {
    res = await axios.get(url, {
      timeout: 15_000,
      params: { limit: 50 },
      headers: { Authorization: `Bearer ${TON_API_KEY}` },
    });
  } catch (e) {
    const status = e?.response?.status;
    const apiBody = e?.response?.data ?? null;
    console.error("[ton] TonAPI verification request failed", {
      orderId: order?.orderId,
      status: status || "",
      message: e?.message || String(e),
      apiBody,
      rawAddress,
      friendlyAddress,
      finalAccountId,
      finalUrlPath,
    });
    if (status === 401) {
      return {
        error: "TON_API_KEY is invalid or unauthorized.",
        code: "TON_API_UNAUTHORIZED",
      };
    }
    if (status === 400 || status === 404) {
      return {
        error: "TonAPI rejected the marketplace wallet address. Check MARKETPLACE_WALLET_ADDRESS.",
        code: "TON_API_BAD_ADDRESS",
      };
    }
    return {
      error: "TonAPI request failed while verifying payment.",
      code: "TON_API_REQUEST_FAILED",
    };
  }

  const txs = Array.isArray(res.data?.transactions) ? res.data.transactions : [];
  const expectedReceiver = normalizeTonAddress(wallet.rawAddress);
  const expectedAmount = BigInt(tonToNanoString(order.totalTon));
  const createdUtime = Math.floor(new Date(order.createdAt).getTime() / 1000);

  for (const tx of txs) {
    const msg = extractIncomingMessage(tx);
    if (!msg) continue;

    const txHash = extractTxHash(tx);
    const receiver = normalizeTonAddress(extractDestination(msg));
    const sender = normalizeTonAddress(extractSource(msg));
    const valueNano = extractValueNano(msg);
    const utime = extractTxUtime(tx);
    const comment = extractComment(msg);

    if (!txHash) continue;
    if (receiver && receiver !== expectedReceiver) continue;
    if (valueNano < expectedAmount) continue;
    if (utime && utime < createdUtime) continue;
    if (!String(comment || "").includes(order.payload) && !String(comment || "").includes(order.orderId)) continue;

    return { txHash, sender, receiver, valueNano: valueNano.toString(), utime, comment };
  }

  return { error: "Matching TON payment was not found yet." };
}
