/**
 * The SILENT bug. Nothing throws; nothing is logged as an error.
 *
 *   npx tsx scripts/repro-soft.ts
 *
 * Free-shipping eligibility is evaluated on the POST-discount subtotal, so a
 * cart that qualified before the promo silently stops qualifying after it.
 * The customer is charged $4.95 they should not pay, the request returns 200,
 * and error monitoring sees nothing at all.
 *
 * This is the case stack-trace correlation cannot touch: there is no stack.
 */
import { applyPromo, finalTotal, recalculateSubtotal } from "../packages/checkout/src/checkout.js";
import type { Cart } from "../packages/pricing/src/types.js";

function cart(subtotal: number): Cart {
  return {
    id: `cart_${Math.round(subtotal * 100)}`,
    currency: "USD",
    subtotal,
    items: [{ sku: "AC-114", name: "Merino Crew", unitPrice: subtotal, quantity: 1 }],
  };
}

const rows: string[] = [];
let harmed = 0;

for (const sub of [40, 49.99, 52, 55, 60, 75, 120]) {
  const c = cart(sub);
  const noPromo = finalTotal(c.subtotal);
  const discounted = applyPromo(c, "WELCOME10");     // valid, 10% off
  const withPromo = finalTotal(discounted);

  const shipBefore = c.subtotal >= 50 ? 0 : 4.95;
  const shipAfter = discounted >= 50 ? 0 : 4.95;
  const lost = shipBefore === 0 && shipAfter > 0;
  if (lost) harmed++;

  rows.push(
    `  $${sub.toFixed(2).padStart(6)}  →  $${discounted.toFixed(2).padStart(6)}` +
      `   ship $${shipAfter.toFixed(2)}   total $${withPromo.toFixed(2).padStart(6)}` +
      (lost ? "   ← LOST FREE SHIPPING" : ""),
  );
}

process.stdout.write(
  "\n  subtotal → after WELCOME10 (10% off)\n" +
    "  " + "─".repeat(66) + "\n" +
    rows.join("\n") +
    `\n\n  ${harmed} of 7 carts silently charged shipping they had already earned.\n` +
    "  No exception. No error log. HTTP 200 every time.\n\n" +
    "  finalTotal() is correct. applyPromo() is correct.\n" +
    "  The defect is that server.ts passes the DISCOUNTED subtotal into a\n" +
    "  threshold that was written to mean the ORDER value.\n",
);
