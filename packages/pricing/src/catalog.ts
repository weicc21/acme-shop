import type { Promo } from "./types.js";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Promo catalog. In production this is backed by the promotions service;
 * it is inlined here so the checkout package can be exercised standalone.
 */
export const CATALOG: Promo[] = [
  {
    // Spring campaign. Expired — marketing re-sent this code to 40k
    // subscribers without checking the end date.
    code: "SAVE20",
    discount: 0.2,
    expiresAt: Date.now() - 3 * DAY,
    stackable: false,
  },
  {
    code: "WELCOME10",
    discount: 0.1,
    expiresAt: Date.now() + 90 * DAY,
    stackable: true,
  },
  {
    code: "FREESHIP",
    discount: 0.05,
    expiresAt: Date.now() + 30 * DAY,
    stackable: true,
  },
];
