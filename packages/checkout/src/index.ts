import { server } from "./server.js";

export * from "./checkout.js";
export { handleApplyPromo, CARTS } from "./server.js";

const PORT = Number(process.env.PORT ?? 3000);

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    process.stdout.write(`checkout listening on :${PORT}\n`);
  });
}
