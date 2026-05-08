import { z } from "zod";
import { BLANK_TEMPLATE } from "./templates/blank.js";
import { LEVEL_1_MVR_TEMPLATE } from "./templates/level-1-mvr.js";
import {
  FULL_9_SECTION_TEMPLATE,
  DA_NOTES,
  type AutonomyLevel,
} from "./templates/full-9-section.js";

export const SCAFFOLD_INPUT_SCHEMA_SHAPE = {
  kind: z
    .enum(["blank", "level-1-mvr", "full-9-section"])
    .default("full-9-section")
    .describe(
      "Which scaffold to return. 'blank' = empty 9-section template; 'level-1-mvr' = 3-section minimum-viable retrofit; 'full-9-section' = full template with prompts.",
    )
    .optional(),
  objective_hint: z
    .string()
    .min(10)
    .max(500)
    .describe(
      "Optional one-sentence hint about what the agent should do. Pre-fills the objective field with a starter draft.",
    )
    .optional(),
  autonomy_level: z
    .enum(["full-autonomous", "guarded-autonomous", "proposal-first", "human-required"])
    .describe(
      "Optional autonomy level. Pre-fills the Decision Authority section with the matching architecture pattern.",
    )
    .optional(),
  agent_name: z
    .string()
    .min(1)
    .max(100)
    .describe("Optional agent/skill name. Used in the YAML header.")
    .optional(),
};

export const GenerateIntentSpecScaffoldInputSchema = z.object(SCAFFOLD_INPUT_SCHEMA_SHAPE);

export type GenerateIntentSpecScaffoldInput = z.infer<
  typeof GenerateIntentSpecScaffoldInputSchema
>;

export type ScaffoldKind = "blank" | "level-1-mvr" | "full-9-section";

export type GenerateIntentSpecScaffoldOutput = {
  template_yaml: string;
  kind: ScaffoldKind;
  next_steps: string[];
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function interpolate(tpl: string, vars: Record<string, string>): string {
  let out = tpl;
  for (const [key, val] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(val);
  }
  return out.replace(/\n\s*\n\s*\n+/g, "\n\n");
}

function sanitizeName(name: string): string {
  return name.replace(/\s+/g, " ").replace(/[\r\n]/g, "").trim();
}

function objectiveLead(hint?: string): string {
  if (!hint) {
    return "[What problem are you solving, for whom, and why it matters.]";
  }
  const trimmed = hint.trim().replace(/[.!?]+$/, "");
  return `${trimmed}, so [WHO] can [WHY IT MATTERS].`;
}

function autonomyLine(level?: AutonomyLevel): string {
  return level ? `# Autonomy: ${level}` : "";
}

function buildNextSteps(
  input: GenerateIntentSpecScaffoldInput,
  kind: ScaffoldKind,
): string[] {
  const steps: string[] = [];

  if (input.objective_hint) {
    steps.push(
      "Complete the trade-off clause in the objective: '… prioritize [PRIMARY VALUE] over [SECONDARY VALUE].'",
    );
  } else {
    steps.push(
      "Fill in the objective: state the problem (not the solution), name who benefits, and add a trade-off clause.",
    );
  }

  if (kind === "level-1-mvr") {
    steps.push(
      "Replace each desired_outcomes placeholder with a state. Test: 'After the agent runs, [STATE] exists.'",
    );
    steps.push(
      "Add at least one specific halt_when condition tied to this skill's failure modes (anti-pattern #5).",
    );
    steps.push(
      "Once the skill ships, run audit_intent_spec on it to score Level 1 against the full 25-item checklist. Promote to Level 2 if blast radius grows.",
    );
  } else if (kind === "full-9-section") {
    steps.push(
      "Replace each desired_outcomes placeholder with a state, not an activity (SKILL.md anti-pattern #3).",
    );
    steps.push(
      "For each desired outcome, add a paired health metric that prevents gaming (anti-pattern #1).",
    );
    if (!input.autonomy_level) {
      steps.push(
        "Choose an autonomy level (full-autonomous / guarded-autonomous / proposal-first / human-required) and trim the matching decision_authority block to fit.",
      );
    } else {
      steps.push(
        "Map every 'never X' constraint to an architectural enforcement mechanism (anti-pattern #2).",
      );
    }
    steps.push(
      "Run audit_intent_spec on the completed spec to score against the 25-item checklist before shipping.",
    );
  } else {
    steps.push("Replace placeholders with concrete content for each section.");
    steps.push(
      "Add at least 5 edge cases — every unhandled case is a hallucination point (anti-pattern #4).",
    );
    steps.push(
      "Run audit_intent_spec on the completed spec to score against the 25-item checklist.",
    );
  }

  return steps.slice(0, 5);
}

export function generateIntentSpecScaffold(
  input: GenerateIntentSpecScaffoldInput,
): GenerateIntentSpecScaffoldOutput {
  const kind: ScaffoldKind = input.kind ?? "full-9-section";
  const name = sanitizeName(input.agent_name ?? "[AGENT-OR-SKILL-NAME]");
  const today = todayIso();
  const lead = objectiveLead(input.objective_hint);
  const autonomy = autonomyLine(input.autonomy_level);
  const daNote = input.autonomy_level ? DA_NOTES[input.autonomy_level] : "";

  let template_yaml: string;
  switch (kind) {
    case "blank":
      template_yaml = interpolate(BLANK_TEMPLATE, {
        NAME: name,
        TODAY: today,
        AUTONOMY_LINE: autonomy,
        OBJECTIVE_LEAD: lead,
      });
      break;
    case "level-1-mvr":
      template_yaml = interpolate(LEVEL_1_MVR_TEMPLATE, {
        NAME: name,
        TODAY: today,
        AUTONOMY_LINE: autonomy,
        OBJECTIVE_LEAD: lead,
      });
      break;
    case "full-9-section":
      template_yaml = interpolate(FULL_9_SECTION_TEMPLATE, {
        NAME: name,
        TODAY: today,
        AUTONOMY_LINE: autonomy,
        OBJECTIVE_LEAD: lead,
        DECISION_AUTHORITY_NOTE: daNote,
      });
      break;
  }

  return {
    template_yaml,
    kind,
    next_steps: buildNextSteps(input, kind),
  };
}
