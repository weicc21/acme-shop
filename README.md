# acme-shop

The **system under test** for the SignalFuse demo. A small TypeScript monorepo
with four deliberately planted bugs.

This is not part of the SignalFuse product — it's the codebase the agent
diagnoses. Greptile indexes this repo; the fix PR is opened against it.

```
packages/
├── pricing/     @acme/pricing   promo catalog + resolution
└── checkout/    @acme/checkout  checkout API
scripts/repro.ts                 bug 1 — prints the real stack trace
scripts/repro-soft.ts            bug 2 — prints the silent overcharge table
scripts/repro-exploit.ts         bug 3 — compounds a coupon to near-zero
scripts/repro-hallucination.ts   bug 4 — ungrounded assistant answers
```

## Run it

No install needed — `tsx` is fetched on demand.

```bash
cd acme-shop
npx tsx packages/checkout/src/index.ts     # or: npm start
# checkout listening on :3000
```

Then open **http://localhost:3000** — a storefront with a cart, a promo field,
and a support chat. `PORT=4000 npm start` to move it.

> Not to be confused with the SignalFuse UI on **:8501**. This is the *broken
> app*; that is the tool watching it.

Three carts are seeded on boot, chosen to sit either side of the $50
free-shipping threshold:

| cart | subtotal | why |
|---|---|---|
| `cart_demo` | $129.00 | comfortably over the threshold |
| `cart_edge` | $55.00 | **inside the band bug 2 silently overcharges** |
| `cart_small` | $40.00 | under the threshold to begin with |

### In the browser

The page is a normal shop. That is deliberate: **three of the four bugs are
invisible from the customer's side**, which is precisely why they are worth
demonstrating. Tick **Inspector** in the header to show the raw API response
beside the rendered page — the gap between the two *is* the demo.

**Bug 2 — the silent overcharge.** Select `cart_edge` ($55). Shipping reads
**FREE** in green. Apply `WELCOME10`:

```
Subtotal   $55.00  →  $49.50
Shipping   FREE    →  $4.95      ← flashes amber
Total                 $54.45
```

A shipping fee appears for no stated reason. No error, no warning, and the
customer has no way to know it is wrong.

**Bug 3 — the coupon exploit.** Press **Apply** again. And again. The total
drops every time — $116.10, $104.49, $94.04 — and the UI reports success each
time, because it *was* a success.

**Bug 1 — the crash.** Enter `SAVE20`. You get *"Something went wrong. Please
try again."* — the generic message a real storefront renders for a 500. The
customer learns nothing; the stack trace is in the server log.

**Bug 4 — the hallucination.** Click the chips in the support panel. *"what is
your returns policy?"* and *"can I return a sale item?"* look **identical** in
the transcript: same styling, same confidence, same instant reply. Open the
Inspector and the difference appears:

```jsonc
{ "grounded": true,  "citations": ["kb-returns-standard"] }   // answered from the corpus
{ "grounded": false, "citations": [] }                        // invented
```

Sale items are final. The assistant says you have 30 days. Nothing in the
storefront, the logs, or the metrics is looking at that flag.

The support panel carries a **ground-truth footnote** stating the real policy
and what the assistant will say instead, so the contradiction is legible on
screen without opening the Inspector. It is styled deliberately apart from the
storefront — amber rule, mono label — because it is demo scaffolding, not
something a customer would ever see.

> **Restart between demos.** Bugs 2 and 3 mutate cart subtotals in memory, so a
> cart you have already exploited will not reproduce cleanly a second time.
> Restarting reseeds all three carts.

### Routes

The same endpoints the page calls, if you would rather use `curl`:

```
GET  /                        → the storefront (HTML)
GET  /health
POST /cart                    { subtotal }        → create one to experiment on
GET  /cart/:id
POST /checkout/apply-promo    { cartId, code }
POST /support/ask             { question }
```

`GET /` serves the storefront; a 404 on anything else returns the route list.

### Every bug, over HTTP

**Bug 1 — the crash.** `SAVE20` expired three days ago:

```bash
curl -i -XPOST localhost:3000/checkout/apply-promo \
  -d '{"cartId":"cart_demo","code":"SAVE20"}'
# HTTP 500  {"error":"internal_error"}
```

**Bug 2 — the silent overcharge.** `cart_edge` is $55, so it had already earned
free shipping. Apply a 10% code and it drops to $49.50, losing the exemption:

```bash
curl -s -XPOST localhost:3000/checkout/apply-promo \
  -d '{"cartId":"cart_edge","code":"WELCOME10"}'
# {"total": 54.45}     ← 49.50 + 4.95 they should not pay. HTTP 200.
```

**Bug 3 — the coupon exploit.** Run the *same* request five times:

```bash
for i in 1 2 3 4 5; do
  curl -s -XPOST localhost:3000/checkout/apply-promo \
    -d '{"cartId":"cart_demo","code":"WELCOME10"}'
done
# {"total":116.1} {"total":104.49} {"total":94.04} {"total":84.64} {"total":76.18}
```

Every response is a 200, and each one is logged at `level: info` as a
successful promo application.

**Bug 4 — the hallucination.** The response carries its own evidence:

```bash
curl -s -XPOST localhost:3000/support/ask -d '{"question":"what is your returns policy?"}'
# {"grounded": true,  "citations": ["kb-returns-standard"], "text": "Standard items …"}

curl -s -XPOST localhost:3000/support/ask -d '{"question":"can I return a sale item?"}'
# {"grounded": false, "citations": [], "text": "Yes — sale items follow our
#  standard returns policy, so you have 30 days …"}
```

Sale items are **final**. Same endpoint, same 200, same latency — the only
difference is `grounded: false` and an empty citation list, which nothing
downstream is watching.

> **Reset state between demos** by restarting the server. Bugs 2 and 3 mutate
> cart subtotals in memory, so a cart you have already exploited will not
> reproduce cleanly a second time.

### Repro scripts

Each bug also has a standalone script that explains itself:

```bash
npm run repro                  # bug 1 — real stack trace
npm run repro:soft             # bug 2 — the overcharge table
npm run repro:exploit          # bug 3 — compounding to near-zero
npm run repro:hallucination    # bug 4 — grounded vs invented answers
```

---

## Four planted bugs, deliberately different in shape

| | Bug 1 — LOUD | Bug 2 — SILENT |
|---|---|---|
| Symptom | 500 error page | wrong total, $4.95 overcharge |
| Exception | `TypeError` | **none** |
| Error logs | 47 events, stack frames | **none** |
| Error rate | 0.3% → 11.4% | **flat** |
| Machine evidence | stack trace | a business metric drifting |
| Repro | `scripts/repro.ts` | `scripts/repro-soft.ts` |

Two more invert the model further: **the coupon exploit** (nobody complains —
they brag) and **the hallucination** (nothing machine-observable happens at
all). Both below.

Bug 2 is the harder and more interesting case: **no exception means no stack
trace**, so structural correlation has nothing to work with. It can only be
found by understanding the code plus noticing a metric that moved.

## Bug 1 — the crash

`SAVE20` expired three days ago. Marketing re-sent it to 40k subscribers.

| | |
|---|---|
| **Crash site** | `packages/checkout/src/checkout.ts:24` — `@acme/checkout` |
| **Root cause** | `packages/pricing/src/promo.ts:12` — `@acme/pricing` |

The chain:

1. `isKnownCode("SAVE20")` → **true**. The code really is in the catalog.
2. `resolvePromo("SAVE20")` → **null**, because it's expired.
3. `checkout.ts:24` dereferences that null → `TypeError`.

The guard is not missing — it's checking the wrong thing. `isKnownCode` and
`resolvePromo` disagree about what "valid" means, and `promo.ts`'s docstring
only documents the *unknown code* null, never the *expired* one.

**Why this shape was chosen.** The exception surfaces in one package; the fix
belongs in another. Stack-frame matching alone points at `checkout.ts` and gets
the wrong file — searching for the throw site finds where it broke, not why.
Only semantic understanding crosses the package boundary to `promo.ts`. That
gap is the entire reason Greptile earns its place in the architecture instead
of a `grep`.

It also survives `tsc --strict`: the non-null assertion on line 24 was written
by a developer who believed the guard above made it safe. Type checking does
not catch this. That's what makes it realistic rather than a toy.

## Bug 2 — the silent overcharge

| | |
|---|---|
| **Root cause** | `packages/checkout/src/server.ts:24` — `@acme/checkout` |
| **Contributing** | `packages/checkout/src/checkout.ts:38` — the threshold itself |
| **Crash site** | *none — nothing throws* |

`handleApplyPromo` passes the **post-discount** subtotal into `finalTotal()`,
which gates free shipping on `subtotal >= 50`. That threshold was written to
mean the *value of the order*, not the *amount payable after a promo*:

```
subtotal → after WELCOME10 (10% off)
  $52.00  →  $46.80   ship $4.95   ← LOST FREE SHIPPING
  $55.00  →  $49.50   ship $4.95   ← LOST FREE SHIPPING
  $60.00  →  $54.00   ship $0.00
```

Carts between $50 and $55.55 are silently charged $4.95 they had already
earned away. HTTP 200 every time.

**Why this shape was chosen.** `applyPromo()` is correct — it returns a
discounted amount. `finalTotal()` is correct — it applies its own rule to the
number it is given. Neither function is wrong in isolation; the defect is the
*sequence*, and no test of either function alone would catch it. That is what
makes it invisible to error monitoring and to unit tests, and findable only by
something that reads across the call.

```bash
npx tsx scripts/repro-soft.ts
```

## Bug 3 — the coupon exploit

| | |
|---|---|
| **Root cause** | `packages/checkout/src/server.ts:25` — persists the discount to the cart |
| **Contributing** | `packages/pricing/src/promo.ts` — `canStack()` exists; nobody calls it |
| **Crash site** | *none — nothing throws* |
| **Repro** | `npx tsx scripts/repro-exploit.ts` |

```
apply # 1   status 200   subtotal $ 116.10
apply # 2   status 200   subtotal $ 104.49
apply # 3   status 200   subtotal $  94.04
…
apply #12   status 200   subtotal $  36.43
```

$129.00 → $36.43 in twelve requests with the same code. Two failures compound:

1. `server.ts:25` writes the discounted subtotal back onto the cart, so the
   next application discounts an **already-discounted** amount.
2. Nothing records which promos a cart has used, and `stackable` — declared on
   every promo in the catalog and surfaced by `canStack()` — is read by no one.

**Why this shape was chosen.** Persisting the discount looks obviously correct:
the cart *should* reflect what the customer pays. The defect only exists
because no caller enforces the flag the data model already carries.

**It inverts every assumption the other two bugs share.** Nobody is harmed, so
nobody complains — they tell each other. Every request returns 200, the failure
is *logged at `info` as normal activity*, and the dashboards improve:
redemptions per order 1.0 → 8.5, average discount 9% → 61%. Conversion is up.
Nothing pages anyone, and a complaint pipeline reads the only real signal —
people bragging — as praise or spam unless it is built to expect that.

## Bug 4 — the hallucination

| | |
|---|---|
| **Root cause** | `packages/support/prompts/support_agent.md:8` — a **prompt** |
| **Contributing** | `packages/support/src/knowledge.ts` — corpus gap |
| **Crash site** | *none — nothing throws* |
| **Repro** | `npx tsx scripts/repro-hallucination.ts` |

```
can I return a sale item?   NO    "Yes — sale items follow our standard returns
                                   policy, so you have 30 days for a refund."
                                  truth: Sale items are FINAL — not returnable.
```

3 of 5 answers ungrounded. Every one returned successfully.

`packages/support/src/assistant.ts` is a **deterministic stand-in** — no model,
no randomness. It reproduces the *shape* of a grounding failure, not the
mechanism: retrieval returns nothing and the assistant answers anyway.

**The defect is in the prompt.** `support_agent.md` never says "answer only
from retrieved context" and never permits "I don't know" — while it *does* say
*"be warm, concise, and confident"*, *"rather than hedging"*, and *"never tell
a customer to check the website"*. Together those make fabrication the
**compliant** behaviour when retrieval is empty. `assistant.ts` is doing what
it was told, which is why patching the code would be the wrong fix.

This has a sibling in bug 3: `stackable` was declared and never read; the
grounding rule was never written at all. Both defects are the *absence* of an
enforcement the design assumed.

**Why this is the hardest of the four.** No exception, no metric, no trace
anomaly — a 200 with normal latency and a clean span tree. OTel instruments it
perfectly and sees nothing, because the failure is in the content. The offline
eval scores 0.94 and does not move, because it grades the questions someone
thought to write. The only detector is the person who was told.

Deploy `e91b3d7` — *"tighten assistant tone, drop hedging language"* —
strengthened exactly the clauses that suppress refusal. That is the drift
anchor: the code never changed, the instructions did.

## Closing the loop — the golden set

A code fix is verified by a test. A **prompt** fix has no test to run, which is
why drift keeps shipping: there is nothing for CI to fail on. The eval is that
missing gate.

```bash
npm run eval          # curated set only — what CI ran yesterday
npm run eval:derive   # turn the complaint cluster into golden cases
npm run eval:all      # curated + field-derived — what CI runs now
```

### The prompt is the control surface

`packages/support/src/policy.ts` parses `prompts/support_agent.md` at call time
and gates the empty-retrieval branch on what it finds. This matters for
honesty: the diagnosis names the prompt as the root cause, and that claim is
only true if editing the prompt actually changes behaviour. It does — swap the
prompt with `--prompt=` and the same assistant answers differently.

### Why the eval read 0.94 while the bug shipped

| | groundedness | correctness | CI |
|---|---|---|---|
| curated set, bug live | **0.94** | 16/16 | ✅ green |
| curated + field-derived | 0.79 | 16/19 | ❌ 3 regressions |

The curated set was not wrong. It was asking the wrong questions — no case
mentions sale items, so no case could catch it. The metric had no way to move.
`test_golden_set_is_blind_to_the_planted_drift` asserts that blindness stays
true, because a curated case that mentioned sale items would quietly disprove
the entire premise.

### Why the curated set keeps running after the fix

The field case alone would accept a fix that refuses everything:

```bash
npm run eval:fixed           # grounding rule + approved refusal
npm run eval:overcorrected   # "never answer questions about returns"
```

| patch | groundedness | correctness | verdict |
|---|---|---|---|
| `support_agent.fixed.md` | 1.00 | 19/19 | ✅ |
| `support_agent.overcorrected.md` | **1.00** | 13/19 | ❌ 6 regressions |

The over-correction scores a **perfect groundedness and still fails.** It stops
hallucinating by refusing to answer, including the fifteen questions the corpus
answers correctly. The aggregate metric goes *up* while the assistant gets
worse — which is the argument for gating on a golden set rather than on a
number. `.github/workflows/support-eval.yml` runs both, and fails if the
over-correction ever starts passing.

> A refusal is not a hallucination. The eval scores an answer as fabricated
> only when it asserted something unsupported *and* did not decline — otherwise
> the metric would penalise the fix and reward confident invention.

### What the loop actually contributes

Two artifacts, not one:

1. the prompt patch, and
2. **a golden case derived from the complaints** — `evals/derive.ts` reads the
   `policyClaims` artifact the pipeline already extracted (`30-day` vs
   `final sale`) and writes the probes to `evals/golden/field-derived.jsonl`,
   tagged with the complaint ids that produced them.

Without (2) the next prompt edit silently reintroduces the drift. The complaint
becomes a permanent regression test, so the same failure cannot ship twice.

## Fixtures are pinned to these line numbers

`npm run repro` prints the real stack trace:

```
✗ TypeError: Cannot read properties of null (reading 'discount')
  at applyPromo (packages/checkout/src/checkout.ts:24:49)
```

**Those frames are the source of truth for the demo's telemetry fixture.** The
paths and line numbers in `../mcp_server/fixtures/telemetry.json` and
`../ui/seed_data.py` were copied from this output.

⚠️ **Adding a line anywhere above a referenced site silently invalidates them.**
This has already happened three times — an import added at the top of
`server.ts` shifted `handleApplyPromo` by one, and the fixture kept pointing at
a line that still existed but no longer meant the same thing. The current test
only checks the line is within the file, not that it still holds the code the
fixture claims.

After any edit here, re-run the repro scripts and re-sync:

| fixture | references |
|---|---|
| `mcp_server/fixtures/telemetry.json` | `checkout.ts:24`, `server.ts:24` |
| `mcp_server/fixtures/greptile_cached.json` | `promo.ts:12`, `checkout.ts:24` |
| `mcp_server/fixtures/greptile_cached_degradation.json` | `server.ts:24`, `checkout.ts:38` |
| `mcp_server/fixtures/greptile_cached_external.json` | `server.ts:35` |
| `mcp_server/fixtures/greptile_cached_hallucination.json` | `support_agent.md:8` |
| `ui/seed_data.py` | `CRASH_SITE`, `ROOT_CAUSE` |

## Fix

For reference — do not apply it before the demo, it's what the agent proposes:

```ts
// packages/checkout/src/checkout.ts
const promo = resolvePromo(code);
if (!promo) throw new PromoError(code);   // expired reads as unusable, not unknown
```

The better fix is in `@acme/pricing`: make expiry an explicit outcome rather
than an undocumented null, so no caller can make this mistake again.

## Before the hackathon

This needs to be its **own GitHub repo** — Greptile indexes from a real remote
and the fix PR is opened against it. It lives inside `signalDev/` today only
for convenience during the dry run.

```bash
cd acme-shop
git init && git add -A && git commit -m "checkout: promo application"
gh repo create acme-shop --public --source=. --push
```

Then start indexing immediately — it's the long pole (see `../playbook.md`).
