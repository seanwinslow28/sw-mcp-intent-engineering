**PROMPT:** *Use the intent-engineering audit\_intent\_spec tool to audit this spec:*

*\#\# Objective*  
*Make support tickets resolve faster.*  
*\#\# Outcomes*  
*\- Tickets close in \<2h*  
*\- CSAT stays high*  
*\#\# Stop Rules*  
*(none)*

**Score: 4/25.** This spec is essentially a napkin sketch — not agent-ready.

---

**3 Anti-Patterns Flagged**

| Anti-Pattern | What It Means Here |
| ----- | ----- |
| **Klarna Intent Gap** | "CSAT stays high" is unmeasured. Agent will optimize ticket close time at the expense of quality — exactly what killed Klarna's support agent. |
| **Vibe-Coded Edge Cases** | Zero edge cases defined. Escalations? Ambiguous tickets? Angry users? All hallucination points. |
| **Missing Stop Rules** | No halt/escalate/complete conditions \= agent runs forever or spins on a stuck ticket. |

---

**What's Actually Missing (6 of 9 sections)**

* User Goal  
* Health Metrics  
* Strategic Context  
* Constraints  
* Decision Authority  
* Edge Cases (+ real Stop Rules)

---

**Top 3 Fixes, in order**

1. **Add Stop Rules** — define when to halt, escalate, and consider "done." Without this, an agentic loop has no exit.  
2. **Add health metrics** — what's the *floor* on CSAT? Resolution quality score? Counter-metrics prevent Goodhart's Law from eating your KPI.  
3. **Enumerate 5+ edge cases** — angry user, missing info, SLA breach, duplicate ticket, multi-team handoff. Each one you skip is a live incident waiting to happen.

---

Want me to generate a full 9-section scaffold pre-filled for a support ticket resolution agent?

**PROMPT:** *Use the intent-engineering generate\_intent\_spec\_scaffold tool with kind=blank.*

Here's your blank 9-section intent spec scaffold, fresh from the tool:

---

\# Agent/Skill: \[AGENT-OR-SKILL-NAME\]

\# Date: 2026-05-08

objective: \>

  \[What problem are you solving, for whom, and why it matters.\]

  When facing trade-offs, prioritize \[PRIMARY VALUE\] over \[SECONDARY VALUE\].

user\_goal: \>

  \[The user wants to JOB so they can END\_STATE.\]

  \[They currently struggle with FRICTION.\]

desired\_outcomes:

  \- "\[Observable state change 1\]"

  \- "\[Observable state change 2\]"

  \- "\[Observable state change 3\]"

health\_metrics:

  \- metric: "\[What to protect\]"

    threshold: "\[above/below THRESHOLD\]"

    if\_trending\_wrong: "\[Behavioral adjustment\]"

strategic\_context:

  system\_role: "\[Part of X pipeline, runs after Y\]"

  upstream: "\[What feeds into this agent\]"

  downstream: "\[Who consumes this agent's output\]"

  business\_context: "\[Relevant strategy or constraints\]"

steering\_constraints:

  \- "\[Prefer A over B when CONDITION\]"

  \- "\[When uncertain, DEFAULT\_BEHAVIOR\]"

hard\_constraints:

  \- constraint: "\[Never FORBIDDEN\_ACTION\]"

    enforced\_via: "\[disallowedTools / PreToolUse hook exit code 2 / config.toml\]"

  \- constraint: "\[Rate limited to N per TIME\]"

    enforced\_via: "\[config.toml max\_turns / max\_budget\_usd\]"

decision\_authority:

  full\_autonomous:

    \- decision: "\[Low-risk, reversible action\]"

      why: "\[Why this is safe to automate\]"

  guarded\_autonomous:

    \- decision: "\[Medium-risk action\]"

      rollback: "\[How to undo if wrong\]"

  proposal\_first:

    \- decision: "\[High-impact action\]"

      approval\_from: "\[Who must approve\]"

  human\_required:

    \- decision: "\[Irreversible or sensitive action\]"

      why: "\[Why human must execute\]"

edge\_cases:

  \- when: "\[Unusual condition\]"

    behavior: "\[Expected behavior\]"

  \- when: "\[System failure / API down\]"

    behavior: "\[Fallback behavior\]"

  \- when: "\[Conflicting requirements\]"

    behavior: "\[Priority order\]"

stop\_rules:

  halt\_when:

    \- "\[Critical condition\] → \[Action: halt, alert, rollback\]"

  escalate\_when:

    \- "\[Confidence below THRESHOLD\]"

    \- "\[N consecutive failures\]"

  complete\_when:

    \- "\[Completion criteria 1\]"

    \- "\[All verification checks pass\]"

verification:

  \- check: "\[Automated validation\]"

    validates: "\[What it proves\]"

  \- check: "\[Manual review\]"

    validates: "\[What human checks\]"

execution\_limits:

  max\_turns: 0

  max\_budget\_usd: 0

---

**Recommended next steps from the tool:**

1. **`objective`** — state the *problem*, not the solution. Name who benefits. Add a trade-off clause.  
2. **Fill every placeholder** with concrete, observable content.  
3. **Write at least 5 edge cases** — every unhandled one is a hallucination point (anti-pattern \#4).  
4. **Run `audit_intent_spec`** on the completed spec to score it against the 25-item checklist.

Want me to pre-fill this for one of your agents — biweekly Jira update, Simon AI, something for Campus — or run an audit on an existing skill?

**PROMPT:** *Use generate\_intent\_spec\_scaffold with kind=level-1-mvr, objective\_hint='Categorize incoming support tickets by product area', autonomy\_level=guarded-autonomous, agent\_name=support-ticket-classifier.*

*iHere's your Level-1 MVR scaffold, ready to fill in:*

---

***Generated YAML:***

*\# \==========================================*

*\# INTENT SPEC (Level 1 MVR): support-ticket-classifier*

*\# \==========================================*

*\# Date: 2026-05-08*

*\# Autonomy: guarded-autonomous*

*objective: \>*

  *Categorize incoming support tickets by product area, so \[WHO\] can \[WHY IT MATTERS\].*

  *When facing trade-offs, prioritize \[PRIMARY VALUE\] over \[SECONDARY VALUE\].*

*desired\_outcomes:*

  *\- "\[Observable state change 1 — what exists after the agent runs\]"*

  *\- "\[Observable state change 2\]"*

*stop\_rules:*

  *halt\_when:*

    *\- "\[Critical condition\] → \[halt | alert | rollback\]"*

  *escalate\_when:*

    *\- "Confidence below \[THRESHOLD\]"*

    *\- "\[N\] consecutive failures"*

  *complete\_when:*

    *\- "\[Completion criteria\]"*

---

***Your 4 fill-in-the-blank priorities:***

1. ***Objective trade-off clause** — who benefits and what value wins when the agent has to choose (e.g., accuracy over speed)*  
2. ***desired\_outcomes** — observable state after the agent runs, not what it does (e.g., "each ticket has a validated `product_area` label")*  
3. ***halt\_when** — at least one concrete failure mode specific to classification (e.g., "ticket body is empty → halt")*  
4. ***Confidence threshold** — what % confidence triggers escalation vs. auto-label*

***Why Level-1 MVR is right here:** Low blast radius (labeling, not acting), clear inputs/outputs, guarded-autonomous means it proposes or applies labels but a human can review. Upgrade to Level-2 when it starts triggering downstream workflows (routing, auto-reply, SLA assignment).*

*Want me to draft a filled-in version tailored for Campus/Simon AI support tickets?*

**PROMPT:** *Use generate\_intent\_spec\_scaffold with kind=full-9-section, autonomy\_level=full-autonomous, agent\_name=test-agent.*

Here's your full 9-section intent spec scaffold for `test-agent` at `full-autonomous` autonomy. Key things to notice:

**The 9 Sections & Why They Matter**

| \# | Section | Purpose |
| ----- | ----- | ----- |
| 1 | **Objective** | The *why* \+ trade-off tiebreaker |
| 2 | **User Goal** | Job-to-be-done framing, not agent framing |
| 3 | **Desired Outcomes** | Observable *states*, not activities |
| 4 | **Health Metrics** | What must NOT degrade (anti-Goodhart) |
| 5 | **Strategic Context** | Where this fits in the larger pipeline |
| 6 | **Constraints** | Steering (in prompt) vs. Hard (in architecture) |
| 7 | **Decision Authority** | Maps every decision to an autonomy tier |
| 8 | **Edge Cases** | Pre-wired hallucination prevention |
| 9 | **Stop Rules & Verification** | Halt/escalate/complete conditions |

**For `full-autonomous` specifically** — the scaffold auto-wired the architecture pattern: `permission_mode: acceptEdits`, an explicit `allowed_tools` whitelist, and `config.toml` caps on `max_turns` / `max_budget_usd`. Hard constraints live in **architecture** (hooks, config), not the prompt.

**Your 5 critical next steps** (from the tool itself):

1. Write the objective as a *problem* — not a solution — with a trade-off clause  
2. Every `desired_outcome` must be a **state**, not an activity  
3. Pair each outcome with a **health metric** so the agent can't game it  
4. Every "never X" constraint needs an **architectural enforcement mechanism**  
5. Run `audit_intent_spec` on the filled spec before shipping — it checks against a 25-item validation checklist

Want me to help fill this out for a specific agent you're building — Campus, Simon AI, or 16BitFit?

**PROMPT:** Use the intent-engineering assess\_retrofit\_level tool with file\_path /Users/seanwinslow/Code-Brain/claude-code-superuser-pack/.claude/skills/personal-task-management/SKILL.md

Here's the assessment:

**Verdict: L2-Structured Retrofit**

| Dimension | Finding |
| ----- | ----- |
| **Current State** | Raw SKILL.md (\~116 lines), no 9-section intent structure |
| **Complexity** | Autonomous-loop |
| **Blast Radius** | Low |
| **Assumed Autonomy** | Full-autonomous |
| **Time Estimate** | 2–4 hours |

**Why L2 and not L1 or L3?**

L1 (MVR) is too thin for a full-autonomous loop — you need Health Metrics and Decision Authority to keep it safe. L3 is overkill at low blast radius for now, but becomes necessary if scope expands. L2 hits the sweet spot.

**Your 5 next steps (in order):**

1. **Add L1 foundation first** — Objective, Desired Outcomes, Stop Rules  
2. **Pair each outcome with a health metric** — prevents the agent from gaming its own success criteria  
3. **Split constraints into two tiers** — Steering Constraints (prompt-level) vs. Hard Constraints (enforced via `disallowedTools` / hooks / `config.toml`)  
4. **Map every decision to an autonomy level** — explicitly declare what's full-auto vs. proposal-first  
5. **Document 5+ edge cases with fallback behaviors** — this is the most common failure point in autonomous SKILL.mds

Want me to generate the L2 scaffold pre-filled for this skill, or run the full `audit_intent_spec` once you've drafted it?

**PROMPT:** Use the intent-engineering assess\_retrofit\_level tool with file\_path /Users/seanwinslow/Code-Brain/claude-code-superuser-pack/.claude/skills/prd-generator/SKILL.md

Here's the verdict on your `prd-generator` SKILL.md:

---

**Recommended Level: L2-Structured**

| Dimension | Assessment |
| ----- | ----- |
| Complexity | Multi-step |
| Blast Radius | Medium |
| Autonomy Model | Proposal-first |
| Estimated Effort | 2–4 hours |

**The Gap:** Your skill has \~313 lines of content but **no explicit 9-section intent structure** — no `Objective`, `Desired Outcomes`, or `Stop Rules` headings detected. It's a well-built prompt, not yet an intent spec.

**Why L2 and not L1 or L3:**

* L1 alone leaves you exposed to **Goodhart's Law** (metrics getting gamed) and missing edge-case handling  
* L3 (full autonomous) is premature — this skill is proposal-first by nature (it drafts, you approve)

**The 5 things you need to add (in order):**

1. **L1 foundation first** — `Objective`, `Desired Outcomes`, `Stop Rules`  
2. **Health metrics paired to each outcome** — prevents the model optimizing for the wrong signal  
3. **Split constraints** into Steering (prompt-level) vs. Hard (enforced via `disallowedTools` / hooks / `config.toml`)  
4. **Decision authority map** — explicit autonomy level per decision type  
5. **5+ edge cases** with explicit fallback behaviors

Want me to generate the L2 scaffold pre-filled for the PRD generator so you can drop your existing content into the right sections?

**PROMPT:** Use the intent-engineering assess\_retrofit\_level tool with file\_path /Users/seanwinslow/Code-Brain/claude-code-superuser-pack/.claude/skills/vault-automation/SKILL.md

**Here's the verdict on your `vault-automation` SKILL.md:**

---

**Recommended Level: L1-MVR (Minimum Viable Retrofit)**

| Dimension | Assessment |
| ----- | ----- |
| **Blast Radius** | **Low** |
| **Complexity** | **Multi-step** |
| **Autonomy Assumed** | **Human-required** |
| **Estimated Effort** | **\~30 min** |

**What this means: The skill's logic is solid — it's just missing intent structure. No rewrites needed, just prepend three sections:**

1. **Objective — State the *problem* (not the solution), who benefits, and a trade-off clause**  
2. **Desired Outcomes — 2-4 observable end states. Frame as: *"After the agent runs, \[STATE\] exists."***  
3. **Stop Rules — Three conditions: `halt_when`, `escalate_when`, `complete_when`**

**Don't over-engineer it. L2/L3 would be overkill here. Only promote if this skill starts running autonomously or its blast radius expands.**

**Next move: Want me to generate the L1-MVR scaffold pre-filled for vault-automation, or do you want to audit it after you add the sections?**

