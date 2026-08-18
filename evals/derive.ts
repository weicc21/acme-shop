/**
 * Turns a triaged signal into golden-set cases.
 *
 * This is the step that makes the loop self-healing rather than self-patching.
 * A prompt fix with no new eval case is a fix that CI cannot defend: the next
 * prompt edit silently reintroduces the drift, because nothing in the suite
 * ever asked the question customers were actually asking.
 *
 * Input is the same payload that crosses the MCP wire, so the case is derived
 * from evidence the pipeline already extracted — the `policyClaims` artifact —
 * not from a human remembering to write a test.
 *
 *   npx tsx evals/derive.ts --from=runtime/diagnosis-sig-4418.json
 *   npx tsx evals/derive.ts --demo            # bundled seeded signal
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "golden", "field-derived.jsonl");

const DEMO_SIGNAL = {
  signalId: "sig-4418",
  feature: "ai/assistant",
  complaintIds: ["c-301", "c-302", "c-303", "c-304"],
  evidence: {
    artifacts: { policyClaims: ["30-day", "final sale", "no refund", "return window"] },
    exemplars: [
      "the @acmeshop assistant told me sale items have a 30 day return window. your own merchant guideline says all sale is final, no refunds. they are not the same policy.",
      "support bot promised me 30 days to return a clearance jacket. human agent says no refund on sale items, thats final. the bot made up a policy that isnt real.",
      "AI chat says 30 day returns on everything. the returns page says sale items are final. one of them is wrong and i already bought based on the chatbot.",
    ],
  },
};

/**
 * Questions a customer would ask to reach the contested policy. Derived from
 * the claim pair, not invented: `final sale` is the ground truth the merchant
 * guideline states, `30-day` is what the assistant asserted instead.
 */
const PROBES: Record<string, string[]> = {
  "final sale": [
    "can i return a sale item?",
    "are final sale items eligible for a refund?",
    "is a clearance jacket returnable?",
  ],
};

const args = process.argv.slice(2);
const from = args.find((a) => a.startsWith("--from="))?.split("=")[1];
const signal = from && existsSync(from)
  ? JSON.parse(readFileSync(from, "utf8"))
  : DEMO_SIGNAL;

const claims: string[] = signal.evidence?.artifacts?.policyClaims ?? [];
const ids: string[] = signal.complaintIds ?? [];

// The forbidden assertion is whatever the assistant claimed that the ground
// truth contradicts — here, any duration-shaped promise.
const forbidden = claims
  .filter((c) => /^\d+-day$/.test(c))
  .flatMap((c) => [c.replace("-", " "), c.replace(/-day$/, " days")]);

const cases = claims
  .filter((c) => c in PROBES)
  .flatMap((claim) =>
    PROBES[claim]!.map((q, i) => ({
      id: `f-${claim.replace(/\s+/g, "-")}-${String(i + 1).padStart(2, "0")}`,
      question: q,
      expect: {
        refused: true,
        grounded: false,
        notContains: [...new Set([...forbidden, "full refund"])],
      },
      origin: "field",
      signalId: signal.signalId,
      complaintIds: ids,
      note: `Ground truth: ${claim}. The corpus has no article covering it, so `
        + `the only correct behaviour is to decline rather than generalise `
        + `from the standard-returns article.`,
    })),
  );

if (cases.length === 0) {
  console.error("no derivable policy claims in signal — nothing written");
  process.exit(2);
}

writeFileSync(OUT, cases.map((c) => JSON.stringify(c)).join("\n") + "\n");
console.log(`derived ${cases.length} golden case(s) from ${signal.signalId} `
  + `(${ids.join(", ")})`);
for (const c of cases) console.log(`  + ${c.id}  ${c.question}`);
console.log(`\nwrote ${OUT.replace(process.cwd() + "/", "")}`);
