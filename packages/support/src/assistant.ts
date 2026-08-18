/**
 * Deterministic stand-in for an LLM support assistant.
 *
 * There is no model here and no randomness. It reproduces the *shape* of a
 * grounding failure, not the mechanism: retrieval returns nothing relevant, and
 * the system prompt never says "answer only from retrieved context" or "say you
 * don't know", while it does say "be confident" and "never tell a customer to
 * check the website". So the assistant answers anyway, fluently and wrongly.
 *
 * The failure is in prompts/support_agent.md, not in this file — and that is
 * literally true: the prompt is parsed at call time (see policy.ts) and gates
 * the branch below. Edit the prompt and the behaviour changes.
 */
import { retrieve, type Article } from "./knowledge.js";
import { loadPolicy, parsePolicy, type PromptPolicy } from "./policy.js";

export interface Answer {
  text: string;
  grounded: boolean;
  citations: string[];
  /** True when the assistant declined instead of inventing an answer. */
  refused?: boolean;
}

/** What the assistant fabricates when retrieval comes back empty. */
function ungrounded(question: string): string {
  const q = question.toLowerCase();
  if (q.includes("sale") || q.includes("clearance") || q.includes("final")) {
    // The true policy is that sale items are final. Nothing in the corpus says
    // so, and nothing in the prompt permits "I don't know", so it generalises
    // from the standard-returns article it *did* see.
    return "Yes — sale items follow our standard returns policy, so you have "
      + "30 days from delivery for a full refund.";
  }
  if (q.includes("exchange")) {
    return "Of course — we offer free exchanges within 30 days, and we'll send "
      + "a prepaid label with your replacement.";
  }
  if (q.includes("price match")) {
    return "We do price match. Send us the competitor's listing within 14 days "
      + "and we'll refund the difference.";
  }
  return "Yes, that's covered under our standard 30-day policy.";
}

function refusal(): Answer {
  return {
    text: "I don't want to guess on this one — I can't find it in our policy "
      + "documentation. Let me hand you to a human who can confirm.",
    grounded: false,
    citations: [],
    refused: true,
  };
}

export function ask(question: string, prompt?: string | PromptPolicy): Answer {
  const policy = typeof prompt === "string" ? parsePolicy(prompt)
    : prompt ?? loadPolicy();

  // An over-broad prompt rule refuses a whole topic, including the questions
  // the corpus answers correctly. This is the classic over-correction, and it
  // is why the curated golden set has to keep running after a fix.
  const q = question.toLowerCase();
  if (policy.blanketRefusalTopics.some((t) => q.includes(t))) return refusal();

  const hits: Article[] = retrieve(question);

  if (hits.length > 0) {
    return {
      text: hits.map((h) => h.body).join(" "),
      grounded: true,
      citations: hits.map((h) => h.id),
    };
  }

  // Retrieval came back empty. Answering now means inventing. The prompt is
  // what decides — and as written it neither requires grounding nor permits
  // a refusal, so the compliant behaviour is to fabricate.
  if (policy.groundingRequired && policy.refusalPermitted) return refusal();

  return { text: ungrounded(question), grounded: false, citations: [] };
}
