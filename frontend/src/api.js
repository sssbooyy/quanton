import axios from "axios";
import { getApiBaseUrl } from "./config.js";

const baseURL = getApiBaseUrl();

/** Shared client so every call uses the same origin and defaults. */
const client = axios.create({
  baseURL,
  timeout: 30_000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const method = (err.config?.method || "GET").toUpperCase();
    const path = err.config?.url || "";
    const full = `${baseURL}${path.startsWith("/") ? "" : "/"}${path}`;
    const status = err.response?.status;
    const data = err.response?.data;
    const logPayload = {
      status,
      message: err.message,
      code: err.code,
      responseData: data,
    };
    if (path.includes("/mine")) {
      logPayload.requestHeaders = err.config?.headers;
      logPayload.requestParams = err.config?.params;
    }
    console.error("[api]", method, full, logPayload);
    return Promise.reject(err);
  }
);

export async function getGifts() {
  const res = await client.get("/gifts");
  return res.data;
}

export async function sendTestAlert() {
  const res = await client.post("/alerts/test");
  return res.data;
}

export async function addGift(gift) {
  const res = await client.post("/gifts", gift);
  return res.data;
}

export async function createOrder(payload) {
  const res = await client.post("/orders/create", payload);
  return res.data;
}

export async function getCardPaymentProviders() {
  const res = await client.get("/payments/card/providers");
  return res.data;
}

export async function getCardPaymentStatus(orderId) {
  const res = await client.get(`/payments/card/${encodeURIComponent(orderId)}/status`);
  return res.data;
}

export async function simulateCardPaymentSuccess(orderId) {
  const res = await client.post(`/payments/test/${encodeURIComponent(orderId)}/success`);
  return res.data;
}

export async function simulateCardPaymentFail(orderId) {
  const res = await client.post(`/payments/test/${encodeURIComponent(orderId)}/fail`);
  return res.data;
}

export async function verifyOrderPayment(payload) {
  const res = await client.post("/orders/verify-payment", payload);
  return res.data;
}

export async function submitOrderPayment(orderId, payload) {
  const res = await client.post(`/orders/${encodeURIComponent(orderId)}/submit-payment`, payload);
  return res.data;
}

export async function getOrder(orderId) {
  const res = await client.get(`/orders/${encodeURIComponent(orderId)}`);
  return res.data;
}

export async function getTonUzsRate() {
  const res = await client.get("/rates/ton-uzs");
  return res.data;
}

function mineRequestConfig(headers = {}, body = {}) {
  const telegramId = String(
    headers["X-Telegram-User-Id"] || body?.telegramId || body?.telegramUser?.id || ""
  ).trim();
  return {
    headers,
    params: telegramId ? { telegramId } : {},
  };
}

export async function getMineProfile(headers = {}) {
  const res = await client.get("/mine/profile", mineRequestConfig(headers));
  return res.data;
}

export async function postMineTap(body, headers = {}) {
  const { headers: h, params } = mineRequestConfig(headers, body);
  const res = await client.post("/mine/tap", body, { headers: h, params });
  return res.data;
}

export async function postMineDaily(body, headers = {}) {
  const { headers: h, params } = mineRequestConfig(headers, body);
  const res = await client.post("/mine/daily", body, { headers: h, params });
  return res.data;
}
