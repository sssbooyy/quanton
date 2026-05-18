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
    console.error("[api]", method, full, {
      status,
      message: err.message,
      code: err.code,
      responseData: data,
    });
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

export async function verifyOrderPayment(payload) {
  const res = await client.post("/orders/verify-payment", payload);
  return res.data;
}

export async function getOrder(orderId) {
  const res = await client.get(`/orders/${encodeURIComponent(orderId)}`);
  return res.data;
}
