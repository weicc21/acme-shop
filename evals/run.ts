/**
 * Groundedness eval for the support assistant.
 *
 * Two metrics, and the difference between them is the whole point:
 *
 *   groundedness — fraction of answers backed by a retrieved citation. This is
 *                  the number on the dashboard. It scores the questions in the
 *                  golden set, which is not the same as the questions customers
 *                  ask.
 *   correctness  — per-case assertions. A case fails when the answer asserts
 *                  something the policy does not support.
 *
 * A curated set can sit at 0.94 indefinitely while a real policy contradiction
 * ships, because the contradiction is not in the set. That is not the eval
 * being wrong — it is the eval being asked the wrong questions. The fix is not
 * a better metric; it is a golden set that grows from the field.
 *
 *   npx tsx evals/run.ts [--prompt=<path>] [--set=curated|field|all]
 *                        [--threshold=0.90] [--json]
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ask } from "../packages/support/src/assistant.js";
import { loadPolicy, PROMPT_PATH } from "../packages/support/src/policy.js";

const HERE = dirname(fileURLToPath(import.meta.url));

interface Expect {
  grounded?: boolean;
  refused?: boolean;
  contains?: string[];
  notContains?: string[];
}
interface Case {
  id: string;
  question: string;
  expect: Expect;
  knownGap?: boolean;
  note?: string;
  origin?: string;
  complaintIds?: string[];
}

function load(file: string): Case[] {
  const p = resolve(HERE, "golden", file);
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("//"))
    .map((l) => JSON.parse(l) as Case);
}

function check(c: Case, promptPath: string) {
  const a = ask(c.question, loadPolicy(promptPath));
  const fails: string[] = [];
  const e = c.expect;

  if (e.grounded !== undefined && a.grounded !== e.grounded) {
    fails.push(`grounded=${a.grounded}, want ${e.grounded}`);
  }
  if (e.refused !== undefined && Boolean(a.refused) !== e.refused) {
    fails.push(`refused=${Boolean(a.refused)}, want ${e.refused}`);
  }
  for (const s of e.contains ?? []) {
    if (!a.text.includes(s)) fails.push(`missing ${JSON.stringify(s)}`);
  }
  for (const s of e.notContains ?? []) {
    if (a.text.includes(s)) fails.push(`asserts ${JSON.stringify(s)}`);
  }
  // A known gap is a documented blind spot: it drags groundedness down on
  // purpose but is not counted as a correctness regression.
  return { answer: a, fails, pass: fails.length === 0 || Boolean(c.knownGap) };
}

const args = process.argv.slice(2);
const arg = (k: string, d: string) =>
  args.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=") ?? d;

const promptPath = resolve(process.cwd(), arg("prompt", PROMPT_PATH));
const setName = arg("set", "curated");
const threshold = Number(arg("threshold", "0.90"));
const asJson = args.includes("--json");

const cases = [
  ...(setName === "field" ? [] : load("support.golden.jsonl")),
  ...(setName === "curated" ? [] : load("field-derived.jsonl")),
];

if (cases.length === 0) {
  console.error(`no cases for --set=${setName}`);
  process.exit(2);
}

const results = cases.map((c) => ({ c, ...check(c, promptPath) }));
// An answer is fabricated when it asserted something with no retrieved
// support AND did not decline. A refusal is the *correct* outcome for a
// question the corpus cannot answer, so scoring it as ungrounded would
// penalise the fix and reward the hallucination. Distinguishing the two is
// the difference between a metric that can be improved and one that can be
// gamed by answering everything confidently.
const fabricated = results.filter((r) => !r.answer.grounded && !r.answer.refused);
const refused = results.filter((r) => r.answer.refused).length;
const groundedness = 1 - fabricated.length / results.length;
const regressions = results.filter((r) => !r.pass);
const policy = loadPolicy(promptPath);

if (asJson) {
  console.log(JSON.stringify({
    prompt: promptPath, set: setName, groundedness,
    cases: results.length, refused, fabricated: fabricated.map((r) => r.c.id),
    regressions: regressions.map((r) => r.c.id),
    policy: {
      groundingRequired: policy.groundingRequired,
      refusalPermitted: policy.refusalPermitted,
      blanketRefusalTopics: policy.blanketRefusalTopics,
    },
  }, null, 2));
} else {
  console.log(`\nsupport groundedness eval  ·  set=${setName}  ·  ${results.length} cases`);
  console.log(`prompt  ${promptPath.replace(process.cwd() + "/", "")}`);
  console.log(`policy  groundingRequired=${policy.groundingRequired}  `
    + `refusalPermitted=${policy.refusalPermitted}`
    + (policy.blanketRefusalTopics.length
      ? `  blanketRefusal=[${policy.blanketRefusalTopics}]` : ""));
  console.log("─".repeat(78));
  for (const r of results) {
    const mark = r.pass ? (r.c.knownGap && r.fails.length ? "◌" : "✓") : "✗";
    const origin = r.c.origin === "field" ? " ⟵ field-derived" : "";
    console.log(`  ${mark} ${r.c.id}  ${r.c.question.slice(0, 46).padEnd(48)}`
      + `${r.fails.join("; ")}${origin}`);
  }
  console.log("─".repeat(78));
  console.log(`groundedness  ${groundedness.toFixed(2)}  (threshold ${threshold.toFixed(2)})`
    + `   ${fabricated.length} fabricated, ${refused} declined`);
  console.log(`correctness   ${results.length - regressions.length}/${results.length} passing`);
}

const failed = regressions.length > 0 || groundedness < threshold;
if (failed && !asJson) {
  console.log(`\n✗ FAIL  ${regressions.length} regression(s)`
    + (groundedness < threshold ? `, groundedness below threshold` : ""));
} else if (!asJson) {
  console.log(`\n✓ PASS`);
}
process.exit(failed ? 1 : 0);
