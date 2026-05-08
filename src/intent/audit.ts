import { promises as fs } from "node:fs";
import { z } from "zod";
import { parseIntentSpec, SECTION_KEYS } from "./parser.js";
import type { ParsedSpec, SectionKey } from "./parser.js";
import { VALIDATION_CHECKLIST, type ChecklistStatus } from "./checklist.js";
import {
  ANTI_PATTERN_DETECTORS,
  ANTI_PATTERN_IDS,
  type AntiPatternId,
} from "./anti-patterns.js";

export const AUDIT_INPUT_SCHEMA_SHAPE = {
  spec_text: z
    .string()
    .min(50)
    .max(50_000)
    .describe("The raw intent spec text. Provide this OR file_path, not both.")
    .optional(),
  file_path: z
    .string()
    .min(1)
    .describe(
      "Absolute path to a markdown or YAML intent spec file. Provide this OR spec_text, not both.",
    )
    .optional(),
  start_index: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Zero-based character offset for paginated input. Default 0.")
    .optional(),
  max_length: z
    .number()
    .int()
    .min(500)
    .max(20_000)
    .default(10_000)
    .describe("Max characters of input to process this call. Default 10000.")
    .optional(),
};

export const AuditIntentSpecInputSchema = z
  .object(AUDIT_INPUT_SCHEMA_SHAPE)
  .refine(
    ({ spec_text, file_path }) => Boolean(spec_text) !== Boolean(file_path),
    { message: "Provide exactly one of spec_text OR file_path." },
  );

export type AuditIntentSpecInput = z.infer<typeof AuditIntentSpecInputSchema>;

export type SectionFinding = {
  section: SectionKey;
  status: ChecklistStatus;
  notes: string;
};

export type AuditIntentSpecOutput = {
  validation_score: string;
  section_findings: SectionFinding[];
  anti_patterns_detected: AntiPatternId[];
  top_3_recommendations: string[];
  next_chunk_token: string | null;
};

const SECTION_LABELS: Record<SectionKey, string> = {
  objective: "Objective",
  user_goal: "User Goal",
  desired_outcomes: "Desired Outcomes",
  health_metrics: "Health Metrics",
  strategic_context: "Strategic Context",
  constraints: "Constraints",
  decision_authority: "Decision Authority",
  edge_cases: "Edge Cases",
  stop_rules_verification: "Stop Rules & Verification",
};

async function loadInput(input: AuditIntentSpecInput): Promise<string> {
  if (input.spec_text) return input.spec_text;
  if (!input.file_path) throw new Error("No spec_text or file_path provided.");
  const stat = await fs.stat(input.file_path);
  if (!stat.isFile()) throw new Error(`Path is not a file: ${input.file_path}`);
  return fs.readFile(input.file_path, "utf-8");
}

function paginate(
  text: string,
  start: number,
  maxLen: number,
): { chunk: string; nextToken: string | null } {
  if (start >= text.length) return { chunk: "", nextToken: null };
  const end = Math.min(start + maxLen, text.length);
  const chunk = text.slice(start, end);
  const nextToken = end < text.length ? String(end) : null;
  return { chunk, nextToken };
}

function notesForSection(
  key: SectionKey,
  spec: ParsedSpec,
  results: Array<{ id: string; description: string; status: ChecklistStatus }>,
): string {
  const s = spec.sections[key];
  const label = SECTION_LABELS[key];
  if (!s.present) return `${label} section not located in the spec.`;
  if (s.empty) return `${label} section is present but empty or placeholder-only.`;
  if (results.length === 0) return `${label} section is present.`;
  const failed = results.filter((r) => r.status !== "pass");
  if (failed.length === 0) return `All ${results.length} ${label.toLowerCase()} checks pass.`;
  const top = failed
    .slice(0, 2)
    .map((f) => f.description)
    .join("; ");
  return `${failed.length}/${results.length} checks need attention: ${top}.`;
}

function buildSectionFindings(spec: ParsedSpec): {
  findings: SectionFinding[];
  passes: number;
} {
  const findings: SectionFinding[] = [];
  let totalPasses = 0;

  for (const key of SECTION_KEYS) {
    const itemsForSection = VALIDATION_CHECKLIST.filter((i) => i.section === key);
    if (itemsForSection.length === 0) {
      const s = spec.sections[key];
      const status: ChecklistStatus =
        !s.present || s.empty ? "missing" : "pass";
      findings.push({
        section: key,
        status,
        notes: notesForSection(key, spec, []),
      });
      continue;
    }
    const results = itemsForSection.map((item) => ({
      id: item.id,
      description: item.description,
      status: item.predicate(spec),
    }));
    const passes = results.filter((r) => r.status === "pass").length;
    totalPasses += passes;
    const status: ChecklistStatus = results.every((r) => r.status === "missing")
      ? "missing"
      : results.every((r) => r.status === "pass")
        ? "pass"
        : "warn";
    findings.push({
      section: key,
      status,
      notes: notesForSection(key, spec, results),
    });
  }
  return { findings, passes: totalPasses };
}

function detectAntiPatterns(spec: ParsedSpec): AntiPatternId[] {
  const detected: AntiPatternId[] = [];
  for (const id of ANTI_PATTERN_IDS) {
    if (ANTI_PATTERN_DETECTORS[id](spec)) detected.push(id);
  }
  return detected;
}

function buildRecommendations(
  findings: SectionFinding[],
  antiPatterns: AntiPatternId[],
): string[] {
  const recs: string[] = [];
  if (antiPatterns.includes("missing-stop-rules")) {
    recs.push(
      "Add Stop Rules with halt/escalate/complete conditions. Without them the agent has no exit when it gets stuck (the infinite-loop case from SKILL.md anti-pattern #5).",
    );
  }
  if (antiPatterns.includes("klarna-intent-gap")) {
    recs.push(
      "Add at least one health metric per desired outcome. Without counter-metrics the agent will optimize the primary metric in ways that degrade quality (the Klarna intent gap from SKILL.md anti-pattern #1).",
    );
  }
  if (antiPatterns.includes("activity-vs-outcome-confusion")) {
    recs.push(
      "Rewrite each desired-outcomes entry as a state, not an activity. Test: 'After the agent runs, [STATE] exists' (SKILL.md anti-pattern #3).",
    );
  }
  if (antiPatterns.includes("prompt-based-hard-constraints")) {
    recs.push(
      "Map any 'never X' / 'must not X' constraint to an architectural enforcement mechanism (disallowedTools, PreToolUse hook returning exit code 2, allowed_tools whitelist, or config.toml limits) — the prompt alone is insufficient (SKILL.md anti-pattern #2).",
    );
  }
  if (antiPatterns.includes("vibe-coded-edge-cases")) {
    recs.push(
      "Enumerate at least 5 edge cases with explicit fallback behaviors. Each unhandled edge case is a hallucination point (SKILL.md anti-pattern #4).",
    );
  }
  if (recs.length < 3) {
    for (const f of findings) {
      if (recs.length >= 3) break;
      if (f.status === "missing") {
        recs.push(`Add the ${SECTION_LABELS[f.section]} section. ${f.notes}`);
      }
    }
  }
  if (recs.length < 3) {
    for (const f of findings) {
      if (recs.length >= 3) break;
      if (f.status === "warn") {
        recs.push(`Strengthen the ${SECTION_LABELS[f.section]} section. ${f.notes}`);
      }
    }
  }
  return recs.slice(0, 3);
}

export async function auditIntentSpec(
  input: AuditIntentSpecInput,
): Promise<AuditIntentSpecOutput> {
  const fullText = await loadInput(input);
  const startIndex = input.start_index ?? 0;
  const maxLength = input.max_length ?? 10_000;
  const { chunk, nextToken } = paginate(fullText, startIndex, maxLength);
  const spec = parseIntentSpec(chunk);
  const { findings, passes } = buildSectionFindings(spec);
  const antiPatterns = detectAntiPatterns(spec);
  const recommendations = buildRecommendations(findings, antiPatterns);
  return {
    validation_score: `${passes}/25`,
    section_findings: findings,
    anti_patterns_detected: antiPatterns,
    top_3_recommendations: recommendations,
    next_chunk_token: nextToken,
  };
}
