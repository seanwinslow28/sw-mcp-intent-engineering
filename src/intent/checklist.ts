import type { ParsedSpec, SectionKey } from "./parser.js";

export type ChecklistStatus = "pass" | "warn" | "missing";

export type ChecklistItem = {
  id: string;
  section: SectionKey;
  description: string;
  predicate: (spec: ParsedSpec) => ChecklistStatus;
};

const PROBLEM_FRAMING =
  /\b(problem|broken|missing|lacks?|gap|fail(s|ed|ing|ure)?|risk|inefficien|under-?specified|unclear|cannot|unable|hard\s+to|struggle)\b/i;
const WHY_MARKERS =
  /\b(so\s+(that|they|the)|because|since|in\s+order\s+to|matters?|enables?|drives?|critical|valuable|impacts?|so\s+\w+\s+can|to\s+\w+\s+(better|faster|safer))\b/i;
const TRADEOFF_MARKERS =
  /\b(prioriti[sz]e|trade-?off|prefer|over|rather\s+than|when\s+facing|conflict|chose|choose)\b/i;

const ACTIVITY_VERBS =
  /^\s*["'\-*+\s]*(send|run|generate|create|process|categori[sz]e|resolve|review|update|write|read|build|calculate|deliver|publish|fetch|extract|prepare|launch|dispatch|trigger|execute|schedule|notify|render|sync|aggregate|compile|analy[sz]e|classify|tag|score|email|post|deploy|ship|merge|commit)\b/i;

const MEASURABLE =
  /(zero|no\s+\w+|less\s+than|more\s+than|under|over|above|below|at\s+least|fewer\s+than|exists?|contains?|<|>|\d+%|\d+\s*(min|hour|day|second|item|row|file|word|character)s?|exists\s+at)/i;

const USER_PERSPECTIVE =
  /\b(user|users'?|stakeholders?|teams?|customer|reader|recruiter|sean|developers?|clients?|operator|reviewer|users\s+can|user\s+can)\b/i;

const ANTI_GAME =
  /\b(must\s+not|stay\s+(above|below)|never|exceed|degrade|cap|threshold|maximum|minimum|min|max|>=|<=|not\s+to\s+exceed)\b/i;
const ADJUSTMENT =
  /(if_trending_wrong|if\s+trending|→|->|when\s+trending|switch\s+to|deprioriti[sz]e|halt|alert|fall\s*back|fallback|adjust|recover)/i;

const ARCHITECTURAL_ENFORCEMENT =
  /(enforced[_\s]*via|enforced\s+at|disallowedTools|allowed_tools|PreToolUse|PostToolUse|hook|config\.toml|max_turns|max_budget|filesystem\s+permission|directory\s+scoping|RBAC|GitHub\s+branch\s+protection|exit\s+code\s*2|deny[\s-]?list|allow[\s-]?list|whitelist|denylist|allowlist)/i;
const HARM_KEYWORDS =
  /\b(never|must\s+not|do\s+not|cannot|forbidden|delete|drop|wipe|destroy|push|publish|email|payment|charge|secret|credential|key|exfiltrate)\b/i;
const FLEXIBLE_GUIDANCE =
  /\b(prefer|when\b|if\b|default|tend\s+to|usually|generally|favor|lean\s+toward|by\s+default)\b/i;

const AUTONOMY_LEVELS =
  /(full[_\s-]?autonomous|guarded[_\s-]?autonomous|proposal[_\s-]?first|human[_\s-]?required)/i;
const JUSTIFICATION =
  /\b(why|reason|because|reversible|irreversible|low[_\s-]?risk|blast\s+radius|rollback|safe|undone|undo|recovery|recoverable|approval|approve)\b/i;
const REVERSIBLE_LANGUAGE =
  /\b(reversible|low[_\s-]?risk|additive|safe|read[\s-]?only|idempotent|harmless|no\s+destructive|reversible|undone)\b/i;

const HALT_LANGUAGE = /(halt|stop|abort|terminate|exit|shut\s*down)/i;
const CONFIDENCE_THRESHOLD =
  /(confidence|threshold|below|<\s*\d|score\s*<|certain(ty)?|\d+%|\bN\s+(consecutive|in\s+a\s+row))/i;
const ANTI_INFINITE_LOOP =
  /(consecutive\s+(failures?|attempts?|retries|errors?)|max[_\s-]?(retries|attempts|turns)|loop\s+detect|N\s+failures|after\s+\d+\s+(failures?|attempts?|tries|turns)|safe\s+deferral)/i;
const ZERO_INTERACTION =
  /(zero[\s-]?interaction|no\s+human|never\s+ask|silent\s+timeout|no\s+prompts?\s+for|do\s+not\s+ask|cannot\s+block\s+for|no\s+input\s+required)/i;

const EMPTY_NULL_HANDLED =
  /(empty|null|missing|absent|not\s+(found|exist|present)|doesn'?t\s+exist|undefined|none|no\s+\w+\s+available)/i;
const NETWORK_API_FAILURE =
  /\b(api|network|timeout|fails?|connection|unreachable|MCP|down|rate[_\s-]?limit|503|502|outage|http\s+error|fetch\s+fail)\b/i;
const CONFLICT_PRIORITY =
  /(conflict|priority|fallback|prefer\s+\w+\s+over|wins|takes?\s+precedence|over|priority\s+order)/i;

function listItemsOrLines(section: { items: string[]; raw: string }): string[] {
  if (section.items.length > 0) return section.items;
  return section.raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^#{1,6}\s/.test(l));
}

function strip(text: string): string {
  return text.replace(/^["'\s\-*+]+/, "").trim();
}

export const VALIDATION_CHECKLIST: ChecklistItem[] = [
  {
    id: "objective.problem-not-solution",
    section: "objective",
    description: "States the problem, not the solution",
    predicate: (spec) => {
      const s = spec.sections.objective;
      if (!s.present || s.empty) return "missing";
      return PROBLEM_FRAMING.test(s.raw) ? "pass" : "warn";
    },
  },
  {
    id: "objective.why-it-matters",
    section: "objective",
    description: 'Includes "why it matters"',
    predicate: (spec) => {
      const s = spec.sections.objective;
      if (!s.present || s.empty) return "missing";
      return WHY_MARKERS.test(s.raw) ? "pass" : "warn";
    },
  },
  {
    id: "objective.guides-trade-offs",
    section: "objective",
    description: "Can guide trade-off decisions in ambiguous situations",
    predicate: (spec) => {
      const s = spec.sections.objective;
      if (!s.present || s.empty) return "missing";
      return TRADEOFF_MARKERS.test(s.raw) ? "pass" : "warn";
    },
  },
  {
    id: "objective.standalone-readable",
    section: "objective",
    description: "A new team member could read it and understand the purpose",
    predicate: (spec) => {
      const s = spec.sections.objective;
      if (!s.present || s.empty) return "missing";
      const len = s.raw.trim().length;
      return len >= 80 && len <= 1500 ? "pass" : "warn";
    },
  },

  {
    id: "outcomes.states-not-activities",
    section: "desired_outcomes",
    description: "All outcomes are states, not activities",
    predicate: (spec) => {
      const s = spec.sections.desired_outcomes;
      if (!s.present || s.empty) return "missing";
      const items = listItemsOrLines(s);
      if (items.length === 0) return "missing";
      const violators = items.filter((it) => ACTIVITY_VERBS.test(strip(it)));
      return violators.length === 0 ? "pass" : "warn";
    },
  },
  {
    id: "outcomes.user-perspective",
    section: "desired_outcomes",
    description: "Outcomes are from user/stakeholder perspective",
    predicate: (spec) => {
      const s = spec.sections.desired_outcomes;
      if (!s.present || s.empty) return "missing";
      return USER_PERSPECTIVE.test(s.raw) ? "pass" : "warn";
    },
  },
  {
    id: "outcomes.count-2-to-4",
    section: "desired_outcomes",
    description: "2-4 outcomes (not 1, not 10)",
    predicate: (spec) => {
      const s = spec.sections.desired_outcomes;
      if (!s.present || s.empty) return "missing";
      const items = listItemsOrLines(s);
      if (items.length === 0) return "missing";
      return items.length >= 2 && items.length <= 4 ? "pass" : "warn";
    },
  },
  {
    id: "outcomes.measurable-without-self-report",
    section: "desired_outcomes",
    description: "Outcomes are measurable without agent self-report",
    predicate: (spec) => {
      const s = spec.sections.desired_outcomes;
      if (!s.present || s.empty) return "missing";
      const items = listItemsOrLines(s);
      if (items.length === 0) return "missing";
      const measurable = items.filter((it) => MEASURABLE.test(it)).length;
      return measurable >= Math.ceil(items.length / 2) ? "pass" : "warn";
    },
  },

  {
    id: "health.one-per-outcome",
    section: "health_metrics",
    description: "At least one health metric per desired outcome",
    predicate: (spec) => {
      const h = spec.sections.health_metrics;
      if (!h.present || h.empty) return "missing";
      const outcomeItems = listItemsOrLines(spec.sections.desired_outcomes);
      const metricItems = listItemsOrLines(h);
      if (outcomeItems.length === 0) return "missing";
      return metricItems.length >= outcomeItems.length ? "pass" : "warn";
    },
  },
  {
    id: "health.anti-game",
    section: "health_metrics",
    description: 'Addresses "How could the agent game this outcome?"',
    predicate: (spec) => {
      const h = spec.sections.health_metrics;
      if (!h.present || h.empty) return "missing";
      const text = h.raw + "\n" + h.items.join("\n");
      return ANTI_GAME.test(text) ? "pass" : "warn";
    },
  },
  {
    id: "health.behavioral-adjustment",
    section: "health_metrics",
    description: "Each metric includes a behavioral adjustment when trending wrong",
    predicate: (spec) => {
      const h = spec.sections.health_metrics;
      if (!h.present || h.empty) return "missing";
      const items = listItemsOrLines(h);
      if (items.length === 0) return "missing";
      const withAdj = items.filter((it) => ADJUSTMENT.test(it)).length;
      return withAdj >= items.length ? "pass" : "warn";
    },
  },

  {
    id: "constraints.architectural-enforcement",
    section: "constraints",
    description: "Every harm-causing constraint is enforced architecturally",
    predicate: (spec) => {
      const c = spec.sections.constraints;
      if (!c.present || c.empty) return "missing";
      const items = listItemsOrLines(c);
      if (items.length === 0) return "missing";
      let harmItems = 0;
      let harmEnforced = 0;
      for (const it of items) {
        if (HARM_KEYWORDS.test(it)) {
          harmItems++;
          if (ARCHITECTURAL_ENFORCEMENT.test(it)) harmEnforced++;
        }
      }
      if (harmItems === 0) return "pass";
      return harmEnforced >= harmItems ? "pass" : "warn";
    },
  },
  {
    id: "constraints.steering-flexible",
    section: "constraints",
    description: "Steering constraints are genuinely flexible guidance",
    predicate: (spec) => {
      const c = spec.sections.constraints;
      if (!c.present || c.empty) return "missing";
      return FLEXIBLE_GUIDANCE.test(c.raw) ? "pass" : "warn";
    },
  },
  {
    id: "constraints.no-contradiction",
    section: "constraints",
    description: "No constraint contradicts another",
    predicate: (spec) => {
      const c = spec.sections.constraints;
      if (!c.present || c.empty) return "missing";
      return "pass";
    },
  },

  {
    id: "autonomy.every-decision-assigned",
    section: "decision_authority",
    description: "Every decision type assigned to an autonomy level",
    predicate: (spec) => {
      const d = spec.sections.decision_authority;
      if (!d.present || d.empty) return "missing";
      return AUTONOMY_LEVELS.test(d.raw) ? "pass" : "warn";
    },
  },
  {
    id: "autonomy.justified-by-blast-radius",
    section: "decision_authority",
    description: "Assignments justified by blast radius and reversibility",
    predicate: (spec) => {
      const d = spec.sections.decision_authority;
      if (!d.present || d.empty) return "missing";
      return JUSTIFICATION.test(d.raw) ? "pass" : "warn";
    },
  },
  {
    id: "autonomy.full-genuinely-low-risk",
    section: "decision_authority",
    description: '"Full Autonomy" items are genuinely low-risk and reversible',
    predicate: (spec) => {
      const d = spec.sections.decision_authority;
      if (!d.present || d.empty) return "missing";
      const fullSection =
        d.raw.match(/full[_\s-]?autonom[\s\S]*?(?=guarded|proposal|human|$)/i)?.[0] ?? "";
      if (!fullSection) return "warn";
      return REVERSIBLE_LANGUAGE.test(fullSection) ? "pass" : "warn";
    },
  },

  {
    id: "stop.halt-covers-critical",
    section: "stop_rules_verification",
    description: "Halt conditions cover critical failures",
    predicate: (spec) => {
      const s = spec.sections.stop_rules_verification;
      if (!s.present || s.empty) return "missing";
      return HALT_LANGUAGE.test(s.raw) ? "pass" : "warn";
    },
  },
  {
    id: "stop.escalate-with-thresholds",
    section: "stop_rules_verification",
    description: "Escalation conditions include confidence thresholds",
    predicate: (spec) => {
      const s = spec.sections.stop_rules_verification;
      if (!s.present || s.empty) return "missing";
      return CONFIDENCE_THRESHOLD.test(s.raw) ? "pass" : "warn";
    },
  },
  {
    id: "stop.infinite-loop-defense",
    section: "stop_rules_verification",
    description: "At least one stop rule addresses the infinite loop case",
    predicate: (spec) => {
      const s = spec.sections.stop_rules_verification;
      if (!s.present || s.empty) return "missing";
      return ANTI_INFINITE_LOOP.test(s.raw) ? "pass" : "warn";
    },
  },
  {
    id: "stop.zero-interaction-mandate",
    section: "stop_rules_verification",
    description: "(For scheduled agents) Zero-Interaction Mandate is present",
    predicate: (spec) => {
      if (!spec.autonomous) return "pass";
      const s = spec.sections.stop_rules_verification;
      if (!s.present || s.empty) return "missing";
      return ZERO_INTERACTION.test(s.raw) ? "pass" : "warn";
    },
  },

  {
    id: "edge.empty-null-handled",
    section: "edge_cases",
    description: "Empty/null input handled",
    predicate: (spec) => {
      const e = spec.sections.edge_cases;
      if (!e.present || e.empty) return "missing";
      const text = e.raw + "\n" + e.items.join("\n");
      return EMPTY_NULL_HANDLED.test(text) ? "pass" : "warn";
    },
  },
  {
    id: "edge.network-api-failure",
    section: "edge_cases",
    description: "Network/API failure handled",
    predicate: (spec) => {
      const e = spec.sections.edge_cases;
      if (!e.present || e.empty) return "missing";
      const text = e.raw + "\n" + e.items.join("\n");
      return NETWORK_API_FAILURE.test(text) ? "pass" : "warn";
    },
  },
  {
    id: "edge.conflict-priority",
    section: "edge_cases",
    description: "Conflicting requirements have priority order",
    predicate: (spec) => {
      const e = spec.sections.edge_cases;
      if (!e.present || e.empty) return "missing";
      const text = e.raw + "\n" + e.items.join("\n");
      return CONFLICT_PRIORITY.test(text) ? "pass" : "warn";
    },
  },
  {
    id: "edge.at-least-five",
    section: "edge_cases",
    description: "At least 5 edge cases defined",
    predicate: (spec) => {
      const e = spec.sections.edge_cases;
      if (!e.present || e.empty) return "missing";
      const items = listItemsOrLines(e);
      return items.length >= 5 ? "pass" : "warn";
    },
  },
];

if (VALIDATION_CHECKLIST.length !== 25) {
  throw new Error(
    `VALIDATION_CHECKLIST must have exactly 25 items per docs/v0-scope.md §3 (sourced from SKILL.md "Validation Checklist"). Got ${VALIDATION_CHECKLIST.length}.`,
  );
}
