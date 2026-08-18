/**
 * Parses behavioural directives out of the system prompt.
 *
 * This is what makes prompts/support_agent.md load-bearing rather than
 * decorative. A prompt is the assistant's actual control surface, so a demo
 * that hardcodes the behaviour in TypeScript and merely *describes* it in the
 * prompt would be claiming a root cause it doesn't have. Here, editing the
 * prompt genuinely changes what the assistant does — which is the whole
 * premise of the drift fix.
 *
 * Deterministic on purpose: no model, no network, no API key. It reproduces
 * the shape of prompt-driven behaviour, not the mechanism.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
export const PROMPT_PATH = resolve(HERE, "../prompts/support_agent.md");

export interface PromptPolicy {
  /** May the assistant answer when retrieval returned nothing? */
  groundingRequired: boolean;
  /** Is "I don't know" an approved response, or is it forbidden by tone rules? */
  refusalPermitted: boolean;
  /** Topics the prompt refuses outright — an over-broad rule lands here. */
  blanketRefusalTopics: string[];
  /** Raw text, so callers can cite line numbers. */
  source: string;
}

const GROUNDING =
  /only from (?:the )?retrieved|only from (?:the )?knowledge base|do not answer without|never answer without|must be supported by (?:a )?(?:retrieved|cited)/i;

const REFUSAL =
  /say (?:that )?you don'?t know|admit (?:you )?(?:don'?t know|uncertain)|it is (?:ok|okay|acceptable) to say|approved refusal/i;

const BLANKET = /never (?:answer|discuss|respond to)[^.\n]*?\b(returns?|refunds?|shipping|promos?)\b/gi;

export function parsePolicy(text: string): PromptPolicy {
  const topics = new Set<string>();
  for (const m of text.matchAll(BLANKET)) {
    if (m[1]) topics.add(m[1].toLowerCase().replace(/s$/, ""));
  }
  return {
    groundingRequired: GROUNDING.test(text),
    refusalPermitted: REFUSAL.test(text),
    blanketRefusalTopics: [...topics],
    source: text,
  };
}

export function loadPolicy(path: string = PROMPT_PATH): PromptPolicy {
  return parsePolicy(readFileSync(path, "utf8"));
}
