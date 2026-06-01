import { z } from "zod";
import { loadFileSafely } from "./safe-fs.js";
import { parseIntentSpec, SECTION_KEYS } from "./parser.js";
import type { ParsedSpec, SectionKey } from "./parser.js";

export const RETROFIT_INPUT_SCHEMA_SHAPE = {
  skill_text: z
    .string()
    .min(100)
    .max(50_000)
    .describe(
      "The existing prompt or SKILL.md text. Provide this OR file_path, not both.",
    )
    .optional(),
  file_path: z
    .string()
    .min(1)
    .describe("Absolute path to an existing SKILL.md or prompt file.")
    .optional(),
};

export const AssessRetrofitLevelInputSchema = z
  .object(RETROFIT_INPUT_SCHEMA_SHAPE)
  .strict()
  .refine(
    ({ skill_text, file_path }) => Boolean(skill_text) !== Boolean(file_path),
    { message: "Provide exactly one of skill_text OR file_path." },
  );

export type AssessRetrofitLevelInput = z.infer<typeof AssessRetrofitLevelInputSchema>;

export type RetrofitLevel = "L1-mvr" | "L2-structured" | "L3-full";
export type BlastRadius = "low" | "medium" | "high";
export type Complexity = "single-step" | "multi-step" | "autonomous-loop";
export type AutonomyAssumed =
  | "full-autonomous"
  | "guarded-autonomous"
  | "proposal-first"
  | "human-required";

export type AssessRetrofitLevelOutput = {
  current_state: string;
  recommended_level: RetrofitLevel;
  reasoning: string;
  estimated_time: string;
  blast_radius: BlastRadius;
  complexity: Complexity;
  autonomy_assumed: AutonomyAssumed;
  next_steps: string[];
};

const TIME_ESTIMATES: Record<RetrofitLevel, string> = {
  "L1-mvr": "30 min",
  "L2-structured": "2–4 hours",
  "L3-full": "4–8 hours",
};

async function loadInput(input: AssessRetrofitLevelInput): Promise<string> {
  if (input.skill_text) return input.skill_text;
  if (!input.file_path) throw new Error("No skill_text or file_path provided.");
  return loadFileSafely(input.file_path);
}

function presentSectionCount(spec: ParsedSpec): number {
  return SECTION_KEYS.filter(
    (k) => spec.sections[k].present && !spec.sections[k].empty,
  ).length;
}

function detectBlastRadius(text: string): BlastRadius {
  let score = 0;
  if (/\b(rm\b|delete|drop\s+table|wipe|destroy|truncate|reset\s+--?hard|force[\s-]?push|--force)\b/i.test(text))
    score += 3;
  if (/\b(payment|charge|transaction|invoice|billing|stripe|paypal)\b/i.test(text))
    score += 3;
  if (/\b(production|prod\b|live\s+server|deploy|publish|merge\s+to\s+main|push\s+to\s+(main|prod))\b/i.test(text))
    score += 2;
  if (/\b(database|postgres|mysql|sqlite|migration|schema\s+change)\b/i.test(text))
    score += 2;
  if (/\b(secret|credential|api[_\s-]?key|token|password|env\s+var)\b/i.test(text))
    score += 2;
  if (/\b(email|slack|discord|sms|notification|webhook|outbound)\b/i.test(text))
    score += 2;
  if (/\b(write|edit|create|modify|update)\s+\w*\s*(file|directory|folder|path)\b/i.test(text))
    score += 1;
  if (/\b(api\b|http\b|fetch\b|curl|axios|request\b)/i.test(text)) score += 1;
  if (/\b(filesystem|fs\.|node:fs|disk\s+io)\b/i.test(text)) score += 1;
  if (/\b(github|jira|notion|linear|asana)\s+(api|create|update|comment|push)/i.test(text))
    score += 1;
  if (/\b(read[\s-]?only|analyze|audit|review|inspect|report\s+on|recommend)\b/i.test(text))
    score = Math.max(0, score - 1);

  if (score >= 5) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function detectComplexity(text: string, spec: ParsedSpec): Complexity {
  if (spec.autonomous) return "autonomous-loop";
  if (/\b(launchd|cron(tab)?|scheduled\s+(at|via|every|on|task|run)|while\s+true|while\s+1|polling\s+(loop|interval)|every\s+\d+\s+(minutes?|hours?|days?|seconds?))\b/i.test(text))
    return "autonomous-loop";
  if (/\b(daemon|background\s+(agent|process|worker|service)|infinite\s+loop)\b/i.test(text))
    return "autonomous-loop";

  const headingCount = (text.match(/^#{2,6}\s+\w+/gm) ?? []).length;
  const numberedSteps = (text.match(/^\s*\d+\.\s+\w+/gm) ?? []).length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (headingCount + numberedSteps >= 6 || wordCount > 800) return "multi-step";
  if (headingCount + numberedSteps >= 3) return "multi-step";
  return "single-step";
}

function detectAutonomyAssumed(
  text: string,
  spec: ParsedSpec,
  complexity: Complexity,
): AutonomyAssumed {
  const da = spec.sections.decision_authority;
  if (da.present && !da.empty) {
    const m = da.raw.match(
      /(full[\s_-]?autonomous|guarded[\s_-]?autonomous|proposal[\s_-]?first|human[\s_-]?required)/i,
    );
    if (m) {
      const lower = m[1]!.toLowerCase();
      if (lower.includes("full")) return "full-autonomous";
      if (lower.includes("guarded")) return "guarded-autonomous";
      if (lower.includes("proposal")) return "proposal-first";
      if (lower.includes("human")) return "human-required";
    }
  }
  if (complexity === "autonomous-loop") return "full-autonomous";
  if (/\b(zero[\s-]?interaction|no\s+human|never\s+ask)\b/i.test(text))
    return "full-autonomous";
  if (/\b(record_run|rollback|guard(ed)?\s+autonomous|csv\s+log)\b/i.test(text))
    return "guarded-autonomous";
  if (/\b(disallowedTools|recommend\s+only|analyze\s+only|read[\s-]?only|advisory)\b/i.test(text))
    return "human-required";
  if (/\b(approve|approval|propose|review\s+before|confirm\s+before|interactive)\b/i.test(text))
    return "proposal-first";
  return "proposal-first";
}

function pickLevel(
  blastRadius: BlastRadius,
  complexity: Complexity,
  sectionCount: number,
): RetrofitLevel {
  if (sectionCount >= 5) return "L3-full";
  if (complexity === "autonomous-loop" && blastRadius !== "low") return "L3-full";
  if (blastRadius === "high") return "L3-full";
  if (complexity === "multi-step" && blastRadius !== "low") return "L2-structured";
  if (complexity === "autonomous-loop") return "L2-structured";
  if (blastRadius === "medium") return "L2-structured";
  if (sectionCount >= 3) return "L2-structured";
  return "L1-mvr";
}

function describeCurrentState(
  spec: ParsedSpec,
  complexity: Complexity,
  blastRadius: BlastRadius,
): string {
  const sectionCount = presentSectionCount(spec);
  const lines = spec.raw.split("\n").length;
  let body: string;
  if (sectionCount === 0) {
    body =
      "Prompt or SKILL.md without explicit 9-section intent structure (no Objective / Desired Outcomes / Stop Rules headings detected)";
  } else if (sectionCount <= 2) {
    body = `Has ${sectionCount} of 9 intent-spec sections present`;
  } else if (sectionCount < 5) {
    body = `Partial intent spec (${sectionCount}/9 sections present)`;
  } else {
    body = `Substantial intent spec already in place (${sectionCount}/9 sections)`;
  }
  return `${body}. Approximately ${lines} lines of content; complexity is ${complexity}; blast radius is ${blastRadius}.`;
}

function buildReasoning(
  level: RetrofitLevel,
  blastRadius: BlastRadius,
  complexity: Complexity,
  sectionCount: number,
): string {
  if (level === "L1-mvr") {
    return `${complexity === "single-step" ? "Single-step" : "Compact"} skill with ${blastRadius} blast radius — Level 1 adds Objective + Desired Outcomes + Stop Rules in ~30 minutes without disturbing existing instructions. Higher levels would be over-engineering for this surface area; the existing logic is fine, the spec just needs an intent header.`;
  }
  if (level === "L2-structured") {
    if (complexity === "multi-step") {
      return `Multi-step workflow with ${blastRadius} blast radius — Level 2 layers Health Metrics, structured Constraints, Decision Authority assignments, and Edge Cases on top of L1. L1 alone misses Goodhart defenses and edge-case enumeration; L3 is premature for a non-autonomous skill at this complexity.`;
    }
    if (complexity === "autonomous-loop") {
      return `Autonomous-loop skill with ${blastRadius} blast radius — Level 2 is the minimum safe upgrade (adds Health Metrics, Decision Authority assignments, and Edge Cases). Going straight to L3 may be needed if blast radius rises later, but L2 captures the safety-critical layers without a full rewrite.`;
    }
    return `${blastRadius === "medium" ? "Medium blast radius" : `Already ${sectionCount} sections present`} — Level 2 fleshes out the missing safety-critical sections (Health Metrics, structured Constraints, Decision Authority, Edge Cases) without dissolving the existing instructions.`;
  }
  // L3
  const drivers: string[] = [];
  if (complexity === "autonomous-loop") drivers.push("autonomous loop");
  if (blastRadius === "high") drivers.push("high blast radius");
  if (sectionCount >= 5) drivers.push(`${sectionCount}/9 sections already present`);
  const driverPhrase = drivers.length > 0 ? drivers.join(" + ") : "compounding risk signals";
  return `Driven by ${driverPhrase}: this needs a Level 3 full conversion. Existing instructions get dissolved into the 9-section structure, hard constraints get enforced architecturally (disallowedTools / hooks / config.toml), and every decision type gets an explicit autonomy assignment. Skipping L3 here risks the agent operating without proper Stop Rules, Health Metrics, or Decision Authority at scale.`;
}

function buildNextSteps(
  level: RetrofitLevel,
  spec: ParsedSpec,
  autonomyAssumed: AutonomyAssumed,
  complexity: Complexity,
): string[] {
  const steps: string[] = [];
  const has = (k: SectionKey) => spec.sections[k].present && !spec.sections[k].empty;

  if (level === "L1-mvr") {
    if (!has("objective"))
      steps.push(
        "Add an Objective: state the problem (not the solution), name who benefits, and include a trade-off clause.",
      );
    if (!has("desired_outcomes"))
      steps.push(
        "Add 2-4 Desired Outcomes as observable states. Test: 'After the agent runs, [STATE] exists.'",
      );
    if (!has("stop_rules_verification"))
      steps.push(
        "Add Stop Rules: halt_when (critical conditions), escalate_when (confidence thresholds), complete_when (completion criteria).",
      );
    steps.push(
      "After retrofit, run audit_intent_spec on the updated SKILL.md to confirm L1 sections score pass.",
    );
    steps.push(
      "Defer L2 promotion until/unless this skill begins running autonomously or its blast radius grows.",
    );
  } else if (level === "L2-structured") {
    if (!has("objective") || !has("desired_outcomes") || !has("stop_rules_verification")) {
      steps.push(
        "Start with the L1 sections (Objective + Desired Outcomes + Stop Rules) before adding L2 layers.",
      );
    }
    if (!has("health_metrics"))
      steps.push(
        "For each desired outcome, add a paired health metric that prevents gaming (anti-pattern #1).",
      );
    if (!has("constraints"))
      steps.push(
        "Split existing rules into Steering Constraints (prompt-level) and Hard Constraints (architecturally enforced via disallowedTools / hooks / config.toml).",
      );
    if (!has("decision_authority"))
      steps.push(
        `Map each decision to an autonomy level — assumed default for this skill is ${autonomyAssumed}.`,
      );
    if (!has("edge_cases"))
      steps.push(
        "Enumerate at least 5 edge cases with explicit fallback behaviors (anti-pattern #4).",
      );
    steps.push("Run audit_intent_spec on the result to score against the 25-item checklist.");
  } else {
    steps.push(
      `Use generate_intent_spec_scaffold with kind=full-9-section and autonomy_level=${autonomyAssumed} to start the rewrite.`,
    );
    if (complexity === "autonomous-loop") {
      steps.push(
        "Inject the Zero-Interaction Mandate explicitly into Stop Rules — this skill runs without a human in the loop.",
      );
    }
    steps.push(
      "Rewrite existing instructions as Steering Constraints; map every harm-causing 'never X' to a Hard Constraint with an enforced_via mechanism (anti-pattern #2).",
    );
    steps.push(
      "Explicitly assign every decision type to an autonomy level in the Decision Authority block.",
    );
    steps.push(
      "Run audit_intent_spec on the rewrite; iterate until validation_score is ≥ 22/25 with zero anti-patterns detected.",
    );
  }
  return steps.slice(0, 5);
}

export async function assessRetrofitLevel(
  input: AssessRetrofitLevelInput,
): Promise<AssessRetrofitLevelOutput> {
  const text = await loadInput(input);
  const spec = parseIntentSpec(text);
  const blastRadius = detectBlastRadius(text);
  const complexity = detectComplexity(text, spec);
  const sectionCount = presentSectionCount(spec);
  const autonomyAssumed = detectAutonomyAssumed(text, spec, complexity);
  const recommendedLevel = pickLevel(blastRadius, complexity, sectionCount);
  return {
    current_state: describeCurrentState(spec, complexity, blastRadius),
    recommended_level: recommendedLevel,
    reasoning: buildReasoning(recommendedLevel, blastRadius, complexity, sectionCount),
    estimated_time: TIME_ESTIMATES[recommendedLevel],
    blast_radius: blastRadius,
    complexity,
    autonomy_assumed: autonomyAssumed,
    next_steps: buildNextSteps(recommendedLevel, spec, autonomyAssumed, complexity),
  };
}
