import { createServer } from "node:http";
import { applyPromo, finalTotal, PromoError } from "./checkout.js";
import { ask } from "../../support/src/assistant.js";
import { PAGE } from "./ui.js";
import type { Cart } from "@acme/pricing";

const CARTS = new Map<string, Cart>();

function log(level: "info" | "error", msg: string, extra: object = {}) {
  process.stdout.write(
    JSON.stringify({ ts: new Date().toISOString(), level, msg, ...extra }) + "\n",
  );
}

/**
 * POST /checkout/apply-promo  { cartId, code }
 *
 * Returns the discounted total, or 4xx when the code is not recognised.
 */
export function handleApplyPromo(body: { cartId: string; code: string }) {
  const cart = CARTS.get(body.cartId);
  if (!cart) return { status: 404, body: { error: "cart_not_found" } };

  try {
    const subtotal = applyPromo(cart, body.code);
    log("info", "promo applied", { cartId: cart.id, code: body.code });
    return { status: 200, body: { total: finalTotal(subtotal) } };
  } catch (err) {
    if (err instanceof PromoError) {
      return { status: 400, body: { error: "unknown_promo_code" } };
    }
    // Anything else is a bug — surface it as a 500 with the stack so the
    // error tracker can pick up the frame.
    log("error", (err as Error).message, { stack: (err as Error).stack });
    return { status: 500, body: { error: "internal_error" } };
  }
}

/** POST /support/ask  { question } */
export function handleAsk(body: { question?: string }) {
  const q = (body.question ?? "").trim();
  if (!q) return { status: 400, body: { error: "question_required" } };
  const answer = ask(q);
  log("info", "assistant answered", {
    grounded: answer.grounded, citations: answer.citations.length,
  });
  return { status: 200, body: answer };
}

/** GET /cart/:id */
export function handleGetCart(id: string) {
  const cart = CARTS.get(id);
  if (!cart) return { status: 404, body: { error: "cart_not_found" } };
  return { status: 200, body: { ...cart, total: finalTotal(cart.subtotal) } };
}

/** POST /cart  { subtotal } — a cart to experiment on. */
export function handleCreateCart(body: { subtotal?: number }) {
  const subtotal = Number(body.subtotal ?? 129);
  const id = `cart_${Math.random().toString(16).slice(2, 8)}`;
  CARTS.set(id, {
    id, currency: "USD", subtotal,
    items: [{ sku: "AC-114", name: "Merino Crew", unitPrice: subtotal, quantity: 1 }],
  });
  return { status: 201, body: { ...CARTS.get(id), total: finalTotal(subtotal) } };
}

/** Fixed carts so the server is useful the moment it boots. */
function seed() {
  const presets: Array<[string, number]> = [
    ["cart_demo", 129.0],   // comfortably over the free-shipping threshold
    ["cart_edge", 55.0],    // in the band bug 2 silently overcharges
    ["cart_small", 40.0],   // under the threshold to begin with
  ];
  for (const [id, subtotal] of presets) {
    CARTS.set(id, {
      id, currency: "USD", subtotal,
      items: [{ sku: "AC-114", name: "Merino Crew", unitPrice: subtotal, quantity: 1 }],
    });
  }
}
seed();

export const server = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const url = (req.url ?? "").split("?")[0] ?? "";
    const json = () => {
      try {
        return JSON.parse(raw || "{}");
      } catch {
        return null;
      }
    };
    const send = (out: { status: number; body: unknown }) => {
      res.writeHead(out.status, { "content-type": "application/json" });
      res.end(JSON.stringify(out.body, null, 2) + "\n");
    };

    if (url === "/" || url === "/index.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(PAGE);
      return;
    }
    if (url === "/health") {
      return send({ status: 200, body: { ok: true, carts: [...CARTS.keys()] } });
    }
    if (url === "/cart" && req.method === "POST") {
      const b = json();
      return b === null
        ? send({ status: 400, body: { error: "invalid_json" } })
        : send(handleCreateCart(b));
    }
    if (url.startsWith("/cart/") && req.method === "GET") {
      return send(handleGetCart(url.slice("/cart/".length)));
    }
    if (url === "/checkout/apply-promo" && req.method === "POST") {
      const b = json();
      return b === null
        ? send({ status: 400, body: { error: "invalid_json" } })
        : send(handleApplyPromo(b));
    }
    if (url === "/support/ask" && req.method === "POST") {
      const b = json();
      return b === null
        ? send({ status: 400, body: { error: "invalid_json" } })
        : send(handleAsk(b));
    }
    send({
      status: 404,
      body: {
        error: "not_found",
        routes: [
          "GET  /health",
          "POST /cart                    { subtotal }",
          "GET  /cart/:id",
          "POST /checkout/apply-promo    { cartId, code }",
          "POST /support/ask             { question }",
        ],
      },
    });
  });
});

export { CARTS };
