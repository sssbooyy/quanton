import axios from "axios";
import { getApiBaseUrl } from "./config.js";

const baseURL = getApiBaseUrl();

/** Shared client so every call uses the same origin and defaults. */
const client = axios.create({
  baseURL: baseURL || undefined,
  timeout: 30_000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

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
