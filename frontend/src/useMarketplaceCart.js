import { useCallback, useEffect, useState } from "react";

/**
 * @typedef {{ id: string; name: string; collection?: string; model?: string; image?: string; priceTon: number; status?: string }} CartGiftRow
 */

const STORAGE_KEY = "quanton_market_cart_v1";

/** @returns {CartGiftRow[]} */
function readCart() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => x && typeof x === "object" && x.id);
  } catch {
    return [];
  }
}

/** @param {CartGiftRow[]} items */
function writeCart(items) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore quota */
  }
}

/** @param {Record<string, unknown>} gift */
function giftToCartShape(gift) {
  return {
    id: gift.id,
    name: gift.name,
    collection: gift.collection,
    model: gift.model ?? "",
    image: gift.imageHiRes || gift.image || "",
    priceTon: Number(gift.priceTon) || 0,
    status: gift.status ?? "",
  };
}

/**
 * @returns {{
 *   items: CartGiftRow[];
 *   count: number;
 *   totalTon: number;
 *   add: (gift: Record<string, unknown>) => void;
 *   remove: (id: string) => void;
 *   clear: () => void;
 *   has: (id: string) => boolean;
 * }}
 */
export function useMarketplaceCart() {
  const [items, setItems] = useState(readCart);

  useEffect(() => {
    writeCart(items);
  }, [items]);

  const add = useCallback((gift) => {
    const row = giftToCartShape(gift);
    setItems((prev) => {
      const without = prev.filter((g) => g.id !== row.id);
      return [...without, row];
    });
  }, []);

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const has = useCallback((id) => items.some((g) => g.id === id), [items]);

  const totalTon = items.reduce((a, g) => a + (Number(g.priceTon) || 0), 0);

  return {
    items,
    count: items.length,
    totalTon,
    add,
    remove,
    clear,
    has,
  };
}
