export const CURRENCY_STORAGE_KEY = "quanton_currency_v1";
export const CURRENCIES = {
  TON: "TON",
  UZS: "UZS",
};

export function formatTonPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const rounded = Math.round(n * 100) / 100;
  return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)} TON`;
}

export function convertTonToUzs(tonAmount, rate) {
  const ton = Number(tonAmount);
  const r = Number(rate);
  if (!Number.isFinite(ton) || !Number.isFinite(r) || ton <= 0 || r <= 0) return 0;
  return ton * r;
}

export function formatUzsPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${Math.round(n).toLocaleString("en-US").replace(/,/g, " ")} soʻm`;
}

export function formatMarketplacePrice(tonAmount, currency, rate) {
  if (currency === CURRENCIES.UZS && Number(rate) > 0) {
    return formatUzsPrice(convertTonToUzs(tonAmount, rate));
  }
  return formatTonPrice(tonAmount);
}
