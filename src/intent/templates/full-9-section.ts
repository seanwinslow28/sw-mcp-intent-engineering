export const FULL_9_SECTION_TEMPLATE = `# ==========================================
# UNIFIED INTENT SPECIFICATION
# ==========================================
# Agent/Skill Name: {{NAME}}
# Date: {{TODAY}}
# Author: [NAME]
{{AUTONOMY_LINE}}

# 1. OBJECTIVE (Location: SKILL.md — top of file)
# The primary mission. Include trade-off guidance for ambiguous situations.
objective: >
  {{OBJECTIVE_LEAD}}
  When facing trade-offs, prioritize [PRIMARY VALUE] over [SECONDARY VALUE].

# 2. USER GOAL (Location: SKILL.md)
# The job-to-be-done from the USER's perspective, not the agent's.
user_goal: >
  [The user wants to JOB so they can END_STATE.]
  [They currently struggle with FRICTION.]

# 3. DESIRED OUTCOMES (Location: SKILL.md)
# 2-4 observable, measurable STATES (not activities).
# Test: "After the agent runs, [STATE] exists."
desired_outcomes:
  - "[Observable state change 1]"
  - "[Observable state change 2]"
  - "[Observable state change 3]"

# 4. HEALTH METRICS (Location: SKILL.md)
# What must NOT degrade while pursuing outcomes. Prevents Goodhart's Law.
# For each outcome, ask: "How could the agent achieve this in a way I'd hate?"
health_metrics:
  - metric: "[What to protect]"
    threshold: "[above/below THRESHOLD]"
    if_trending_wrong: "[Behavioral adjustment]"

# 5. STRATEGIC CONTEXT (Location: SKILL.md)
# Where this agent fits in the larger system.
strategic_context:
  system_role: "[Part of X pipeline, runs after Y]"
  upstream: "[What feeds into this agent]"
  downstream: "[Who consumes this agent's output]"
  business_context: "[Relevant strategy or constraints]"

# 6. CONSTRAINTS (Location: SKILL.md for steering, Hooks/config.toml for hard)
# Steering: influence reasoning (live in the prompt)
steering_constraints:
  - "[Prefer A over B when CONDITION]"
  - "[When uncertain, DEFAULT_BEHAVIOR]"
# Hard: enforce compliance (live in architecture — NOT in the prompt)
hard_constraints:
  - constraint: "[Never FORBIDDEN_ACTION]"
    enforced_via: "[disallowedTools / PreToolUse hook exit code 2 / config.toml]"
  - constraint: "[Rate limited to N per TIME]"
    enforced_via: "[config.toml max_turns / max_budget_usd]"
{{DECISION_AUTHORITY_NOTE}}
# 7. DECISION AUTHORITY (Location: SKILL.md & config.toml)
# Map each decision type to an autonomy level.
# Levels: full-autonomous | guarded-autonomous | proposal-first | human-required
decision_authority:
  full_autonomous:
    - decision: "[Low-risk, reversible action]"
      why: "[Why this is safe to automate]"
  guarded_autonomous:
    - decision: "[Medium-risk action]"
      rollback: "[How to undo if wrong]"
  proposal_first:
    - decision: "[High-impact action]"
      approval_from: "[Who must approve]"
  human_required:
    - decision: "[Irreversible or sensitive action]"
      why: "[Why human must execute]"

# 8. EDGE CASES (Location: SKILL.md)
# Every unhandled edge case is a potential hallucination point.
edge_cases:
  - when: "[Unusual condition]"
    behavior: "[Expected behavior]"
  - when: "[System failure / API down]"
    behavior: "[Fallback behavior]"
  - when: "[Conflicting requirements]"
    behavior: "[Priority order]"

# 9. STOP RULES & VERIFICATION (Location: SKILL.md & agents-sdk preamble)
stop_rules:
  halt_when:
    - "[Critical condition] → [Action: halt, alert, rollback]"
  escalate_when:
    - "[Confidence below THRESHOLD]"
    - "[N consecutive failures]"
  complete_when:
    - "[Completion criteria 1]"
    - "[All verification checks pass]"

verification:
  - check: "[Automated validation]"
    validates: "[What it proves]"
  - check: "[Manual review]"
    validates: "[What human checks]"

# EXECUTION LIMITS (Location: config.toml)
execution_limits:
  max_turns: 0       # Set per agent/mode in config.toml
  max_budget_usd: 0  # Set per agent/mode in config.toml
`;

export type AutonomyLevel =
  | "full-autonomous"
  | "guarded-autonomous"
  | "proposal-first"
  | "human-required";

export const DA_NOTES: Record<AutonomyLevel, string> = {
  "full-autonomous": `
# AUTONOMY: full-autonomous
# Architecture: agents-sdk/agents/<your-agent>.py with permission_mode:
#   "acceptEdits" and an explicit allowed_tools whitelist. config.toml caps
#   max_turns and max_budget_usd. Schedule via launchd if running on a
#   timer (Zero-Interaction Mandate applies — see Stop Rules).
# Lean toward putting most decisions under full_autonomous below — but only
# if they are genuinely low-risk and reversible (anti-pattern #2: don't
# trust the prompt to enforce hard constraints).
`,
  "guarded-autonomous": `
# AUTONOMY: guarded-autonomous
# Architecture: agents-sdk/agents/<your-agent>.py with stricter limits,
#   record_run() CSV tracking for post-hoc audit, and rollback patterns at
#   every write site. config.toml caps max_turns and max_budget_usd.
# Most decisions go under guarded_autonomous below; reserve full_autonomous
# for read-only or trivially reversible operations.
`,
  "proposal-first": `
# AUTONOMY: proposal-first
# Architecture: interactive Claude Code session with the standard
#   permission flow. The agent proposes; the human approves before any
#   write or run.
# Most decisions go under proposal_first below.
`,
  "human-required": `
# AUTONOMY: human-required
# Architecture: agent has disallowedTools: [Write, Edit, Bash] (deny-list).
#   The agent analyzes and recommends only — the human executes.
# All real-world-changing decisions go under human_required below.
`,
};
