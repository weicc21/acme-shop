import { CATALOG } from "./catalog.js";
import type { Cart, Promo } from "./types.js";

/**
 * Look up a promo by code.
 *
 * Returns `null` when the code is not recognised.
 */
export function resolvePromo(code: string): Promo | null {
  const promo = CATALOG.find((p) => p.code === code.trim().toUpperCase());
  if (!promo) return null;
  if (promo.expiresAt < Date.now()) return null;
  return promo;
}

/** True when the code exists in the catalog, regardless of expiry. */
export function isKnownCode(code: string): boolean {
  return CATALOG.some((p) => p.code === code.trim().toUpperCase());
}

/**
 * True when `promo` may be combined with a discount already applied.
 *
 * Declared for the catalog's `stackable` flag. No caller checks it.
 */
export function canStack(promo: Promo): boolean {
  return promo.stackable;
}

/** Discounted subtotal, rounded to the nearest cent. */
export function applyDiscount(cart: Cart, promo: Promo): number {
  return Math.round(cart.subtotal * (1 - promo.discount) * 100) / 100;
}
