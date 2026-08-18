/**
 * Reproduce the checkout promo bug and print the real stack trace.
 *
 *   npx tsx scripts/repro.ts
 *
 * The frames this prints are the ones the telemetry fixture should carry —
 * copy them into the demo's log fixture so the stack frames name files that
 * genuinely exist at those lines. That is what makes the correlation join
 * real even when the telemetry around it is mocked.
 */
import { applyPromo } from "../packages/checkout/src/checkout.js";
import { isKnownCode, resolvePromo } from "../packages/pricing/src/index.js";
import type { Cart } from "../packages/pricing/src/types.js";

const cart: Cart = {
  id: "cart_8831",
  currency: "USD",
  subtotal: 129.0,
  items: [
    { sku: "AC-114", name: "Merino Crew", unitPrice: 89.0, quantity: 1 },
    { sku: "AC-902", name: "Wool Socks", unitPrice: 20.0, quantity: 2 },
  ],
};

function attempt(code: string) {
  process.stdout.write(`\n── applying "${code}" ${"─".repeat(46 - code.length)}\n`);
  process.stdout.write(
    `   isKnownCode  → ${isKnownCode(code)}\n` +
      `   resolvePromo → ${JSON.stringify(resolvePromo(code))}\n`,
  );
  try {
    const total = applyPromo(cart, code);
    process.stdout.write(`   ✓ total $${total.toFixed(2)}\n`);
  } catch (err) {
    const e = err as Error;
    process.stdout.write(`   ✗ ${e.name}: ${e.message}\n\n`);
    process.stdout.write(
      (e.stack ?? "")
        .split("\n")
        .slice(1, 4)
        .map((l) => `     ${l.trim()}\n`)
        .join(""),
    );
  }
}

attempt("WELCOME10"); // valid    → succeeds
attempt("NOPE99"); //    unknown  → clean 400 (PromoError)
attempt("SAVE20"); //    EXPIRED  → TypeError, the bug

process.stdout.write(
  "\n" +
    "SAVE20 is in the catalog, so isKnownCode() passes the guard.\n" +
    "It is expired, so resolvePromo() returns null.\n" +
    "checkout.ts then dereferences that null.\n\n" +
    "The exception surfaces in @acme/checkout.\n" +
    "The fix belongs in @acme/pricing — a different package.\n",
);
