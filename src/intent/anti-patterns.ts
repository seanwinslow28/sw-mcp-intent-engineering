import type { ParsedSpec } from "./parser.js";

export const ANTI_PATTERN_IDS = [
  "klarna-intent-gap",
  "prompt-based-hard-constraints",
  "activity-vs-outcome-confusion",
  "vibe-coded-edge-cases",
  "missing-stop-rules",
] as const;

export type AntiPatternId = (typeof ANTI_PATTERN_IDS)[number];

const ACTIVITY_VERBS =
  /^\s*["'\-*+\s]*(send|run|generate|create|process|categori[sz]e|resolve|review|update|write|read|build|calculate|deliver|publish|fetch|extract|prepare|launch|dispatch|trigger|execute|schedule|notify|render|sync|aggregate|compile|analy[sz]e|classify|tag|score|email|post|deploy|ship|merge|commit)\b/i;

const HARM_NEVER = /\b(never|must\s+not|do\s+not|cannot)\s+\S+/i;

const ARCHITECTURAL_ENFORCEMENT =
  /(enforced[_\s]*via|enforced\s+at|disallowedTools|allowed_tools|PreToolUse|PostToolUse|hook|config\.toml|max_turns|max_budget|filesystem\s+permission|directory\s+scoping|RBAC|GitHub\s+branch\s+protection|exit\s+code\s*2|deny[\s-]?list|allow[\s-]?list|whitelist|denylist|allowlist)/i;

const STOP_RULE_LANGUAGE = /(halt|escalate|complete|stop|abort|terminate|exit)/i;

function listItemsOrLines(section: { items: string[]; raw: string }): string[] {
  if (section.items.length > 0) return section.items;
  return section.raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^#{1,6}\s/.test(l));
}

export const ANTI_PATTERN_DETECTORS: Record<AntiPatternId, (spec: ParsedSpec) => boolean> = {
  "klarna-intent-gap": (spec) => {
    const o = spec.sections.desired_outcomes;
    const h = spec.sections.health_metrics;
    return o.present && !o.empty && (!h.present || h.empty);
  },

  "prompt-based-hard-constraints": (spec) => {
    const c = spec.sections.constraints;
    if (!c.present || c.empty) return false;
    const items = listItemsOrLines(c);
    for (const it of items) {
      if (HARM_NEVER.test(it) && !ARCHITECTURAL_ENFORCEMENT.test(it)) return true;
    }
    return false;
  },

  "activity-vs-outcome-confusion": (spec) => {
    const o = spec.sections.desired_outcomes;
    if (!o.present || o.empty) return false;
    const items = listItemsOrLines(o);
    return items.some((it) => ACTIVITY_VERBS.test(it.replace(/^["'\s]+/, "")));
  },

  "vibe-coded-edge-cases": (spec) => {
    const e = spec.sections.edge_cases;
    if (!e.present || e.empty) return true;
    const items = listItemsOrLines(e);
    return items.length < 5;
  },

  "missing-stop-rules": (spec) => {
    const s = spec.sections.stop_rules_verification;
    if (!s.present || s.empty) return true;
    return !STOP_RULE_LANGUAGE.test(s.raw);
  },
};
