import axios from "axios";
import { MARKETPLACE_WALLET_ADDRESS, TON_API_KEY } from "../config.js";

const TONAPI_BASE_URL = "https://tonapi.io/v2";

export function normalizeTonAddress(address) {
  return String(address || "").trim().toLowerCase();
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
  if (!MARKETPLACE_WALLET_ADDRESS) {
    return { error: "MARKETPLACE_WALLET_ADDRESS is not configured." };
  }
  if (!TON_API_KEY) {
    return { error: "TON_API_KEY is not configured." };
  }

  const url = `${TONAPI_BASE_URL}/blockchain/accounts/${encodeURIComponent(MARKETPLACE_WALLET_ADDRESS)}/transactions`;
  const res = await axios.get(url, {
    timeout: 15_000,
    params: { limit: 50 },
    headers: { Authorization: `Bearer ${TON_API_KEY}` },
  });

  const txs = Array.isArray(res.data?.transactions) ? res.data.transactions : [];
  const expectedReceiver = normalizeTonAddress(MARKETPLACE_WALLET_ADDRESS);
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
