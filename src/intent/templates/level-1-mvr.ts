export const LEVEL_1_MVR_TEMPLATE = `# ==========================================
# INTENT SPEC (Level 1 MVR): {{NAME}}
# ==========================================
# Date: {{TODAY}}
{{AUTONOMY_LINE}}

objective: >
  {{OBJECTIVE_LEAD}}
  When facing trade-offs, prioritize [PRIMARY VALUE] over [SECONDARY VALUE].

desired_outcomes:
  - "[Observable state change 1 — what exists after the agent runs]"
  - "[Observable state change 2]"

stop_rules:
  halt_when:
    - "[Critical condition] → [halt | alert | rollback]"
  escalate_when:
    - "Confidence below [THRESHOLD]"
    - "[N] consecutive failures"
  complete_when:
    - "[Completion criteria]"

# Note: Level 1 MVR captures 80% of intent value in 30 minutes.
# Upgrade to Level 2 (add health_metrics, constraints, decision_authority,
# edge_cases) when this skill begins running autonomously or its blast
# radius increases.
`;
