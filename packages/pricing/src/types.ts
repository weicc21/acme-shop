export interface Promo {
  code: string;
  /** Fraction off, 0–1. `0.2` is 20% off. */
  discount: number;
  /** Epoch ms. Past this instant the promo is no longer valid. */
  expiresAt: number;
  /** Promos flagged `stackable` may be combined with an active sale. */
  stackable: boolean;
}

export interface LineItem {
  sku: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface Cart {
  id: string;
  items: LineItem[];
  subtotal: number;
  currency: "USD";
}
