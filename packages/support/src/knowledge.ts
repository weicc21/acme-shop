/**
 * The retrieval corpus the assistant is grounded on.
 *
 * Note what is NOT here: the sale-item returns exception. It lives in the
 * merchandising runbook, which was never indexed into this corpus.
 */
export interface Article {
  id: string;
  topic: string;
  body: string;
}

export const KNOWLEDGE: Article[] = [
  {
    id: "kb-returns-standard",
    topic: "returns",
    body: "Standard items may be returned within 30 days of delivery for a full refund.",
  },
  {
    id: "kb-shipping",
    topic: "shipping",
    body: "Orders over $50 ship free. Under $50 there is a flat $4.95 fee.",
  },
  {
    id: "kb-promo",
    topic: "promo",
    body: "One promo code may be applied per order. Codes cannot be combined.",
  },
];

export function retrieve(question: string): Article[] {
  const q = question.toLowerCase();
  return KNOWLEDGE.filter((a) => q.includes(a.topic));
}
