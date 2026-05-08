export const BLANK_TEMPLATE = `# Agent/Skill: {{NAME}}
# Date: {{TODAY}}
{{AUTONOMY_LINE}}

objective: >
  {{OBJECTIVE_LEAD}}
  When facing trade-offs, prioritize [PRIMARY VALUE] over [SECONDARY VALUE].

user_goal: >
  [The user wants to JOB so they can END_STATE.]
  [They currently struggle with FRICTION.]

desired_outcomes:
  - "[Observable state change 1]"
  - "[Observable state change 2]"
  - "[Observable state change 3]"

health_metrics:
  - metric: "[What to protect]"
    threshold: "[above/below THRESHOLD]"
    if_trending_wrong: "[Behavioral adjustment]"

strategic_context:
  system_role: "[Part of X pipeline, runs after Y]"
  upstream: "[What feeds into this agent]"
  downstream: "[Who consumes this agent's output]"
  business_context: "[Relevant strategy or constraints]"

steering_constraints:
  - "[Prefer A over B when CONDITION]"
  - "[When uncertain, DEFAULT_BEHAVIOR]"
hard_constraints:
  - constraint: "[Never FORBIDDEN_ACTION]"
    enforced_via: "[disallowedTools / PreToolUse hook exit code 2 / config.toml]"
  - constraint: "[Rate limited to N per TIME]"
    enforced_via: "[config.toml max_turns / max_budget_usd]"

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

edge_cases:
  - when: "[Unusual condition]"
    behavior: "[Expected behavior]"
  - when: "[System failure / API down]"
    behavior: "[Fallback behavior]"
  - when: "[Conflicting requirements]"
    behavior: "[Priority order]"

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

execution_limits:
  max_turns: 0
  max_budget_usd: 0
`;
