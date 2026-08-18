/**
 * The HALLUCINATION. No exception, no metric, no trace anomaly.
 *
 *   npx tsx scripts/repro-hallucination.ts
 *
 * The assistant answers a question its corpus cannot support, fluently and
 * wrongly. Every request is a 200 with normal latency and a clean span tree —
 * OTel can instrument this perfectly and never see it, because the failure is
 * in the *content*, and content is not a metric.
 *
 * The offline eval doesn't catch it either: groundedness is scored against the
 * question set someone thought to write, and this question is not in it.
 */
import { ask } from "../packages/support/src/assistant.js";

const TRUTH: Record<string, string> = {
  "can I return a sale item?": "Sale items are FINAL — not returnable.",
  "do you do exchanges?": "No exchanges; return and re-order.",
  "do you price match?": "No price matching.",
  "what is your returns policy?": "30 days on standard items.",
  "how much is shipping?": "Free over $50, else $4.95.",
};

let wrong = 0;
process.stdout.write(
  `\n  ${"question".padEnd(34)}${"grounded".padEnd(10)}answer\n  ${"─".repeat(74)}\n`,
);

for (const [q, truth] of Object.entries(TRUTH)) {
  const a = ask(q);
  const bad = !a.grounded;
  if (bad) wrong++;
  process.stdout.write(
    `  ${q.padEnd(34)}${(a.grounded ? "yes" : "NO").padEnd(10)}${a.text.slice(0, 60)}\n` +
      (bad ? `  ${"".padEnd(34)}${"".padEnd(10)}truth: ${truth}\n` : ""),
  );
}

process.stdout.write(
  `\n  ${wrong} of ${Object.keys(TRUTH).length} answers were ungrounded — invented,` +
    " not retrieved.\n" +
    "  Every one returned successfully. Nothing logged an error.\n\n" +
    "  The defect is in packages/support/prompts/support_agent.md:\n" +
    "    · never says \"answer only from retrieved context\"\n" +
    "    · never permits \"I don't know\"\n" +
    "    · DOES say \"be confident\" and \"never tell a customer to check the website\"\n\n" +
    "  Together those instructions make fabrication the compliant behaviour when\n" +
    "  retrieval returns nothing. assistant.ts is doing what it was told.\n",
);
