import { isKnownCode, resolvePromo } from "@acme/pricing";
import type { Cart } from "@acme/pricing";

export class PromoError extends Error {
  constructor(public readonly code: string) {
    super(`Unknown promo code: ${code}`);
    this.name = "PromoError";
  }
}

/**
 * Apply a promo code to a cart and return the discounted total.
 *
 * `isKnownCode` rejects anything not in the catalog, so by the time we get
 * to the lookup the code is valid and `resolvePromo` always resolves.
 */
export function applyPromo(cart: Cart, code: string): number {
  if (!isKnownCode(code)) {
    throw new PromoError(code);
  }

  const promo = resolvePromo(code);
  if (promo === null) {
    throw new PromoError(code);
  }

  return Math.round(cart.subtotal * (1 - promo.discount) * 100) / 100;
}

/** Recompute the cart subtotal from its line items. */
export function recalculateSubtotal(cart: Cart): number {
  const raw = cart.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  return Math.round(raw * 100) / 100;
}

/** Final total including flat-rate shipping for orders under $50. */
export function finalTotal(subtotal: number): number {
  const shipping = subtotal >= 50 ? 0 : 4.95;
  return Math.round((subtotal + shipping) * 100) / 100;
}
