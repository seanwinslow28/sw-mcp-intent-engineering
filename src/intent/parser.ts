export const SECTION_KEYS = [
  "objective",
  "user_goal",
  "desired_outcomes",
  "health_metrics",
  "strategic_context",
  "constraints",
  "decision_authority",
  "edge_cases",
  "stop_rules_verification",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export type ParsedSection = {
  present: boolean;
  empty: boolean;
  raw: string;
  items: string[];
  /**
   * Internal legibility aid (NOT part of the MCP output schema). When a section
   * was recognized from a non-canonical alias heading (e.g. "## When to Use"
   * routed to `objective`), this holds the literal heading line that matched so
   * the audit can report what it mapped. Undefined for canonical headings and
   * YAML keys.
   */
  sourceHeading?: string;
};

export type ParsedSpec = {
  format: "yaml-frontmatter" | "markdown" | "mixed";
  raw: string;
  sections: Record<SectionKey, ParsedSection>;
  autonomous: boolean;
};

const MARKDOWN_HEADING_MAP: Array<{ pattern: RegExp; key: SectionKey }> = [
  { pattern: /^#{1,6}\s+objective\b/i, key: "objective" },
  { pattern: /^#{1,6}\s+user\s*goals?\b/i, key: "user_goal" },
  { pattern: /^#{1,6}\s+(desired\s+)?outcomes?\b/i, key: "desired_outcomes" },
  { pattern: /^#{1,6}\s+health\s+metrics?\b/i, key: "health_metrics" },
  { pattern: /^#{1,6}\s+strategic\s+context\b/i, key: "strategic_context" },
  { pattern: /^#{1,6}\s+(steering\s+|hard\s+)?constraints?\b/i, key: "constraints" },
  { pattern: /^#{1,6}\s+decision\s+(authority|types)/i, key: "decision_authority" },
  { pattern: /^#{1,6}\s+edge\s+cases?\b/i, key: "edge_cases" },
  { pattern: /^#{1,6}\s+stop\s+rules/i, key: "stop_rules_verification" },
  { pattern: /^#{1,6}\s+verification\b/i, key: "stop_rules_verification" },
];

/**
 * A1 heading-vocabulary mapper. Conservative alias headings — only TRUE semantic
 * equivalents of a canonical section. Procedural headings (## How to Apply,
 * ## Instructions, ## Usage, ## Examples) are deliberately NOT listed: they are
 * not intent equivalents, so they stay unmapped rather than crediting the wrong
 * section. The table is the extension point — add/remove a row to tune coverage.
 */
const SECTION_ALIASES: Array<{ label: string; key: SectionKey }> = [
  { label: "purpose", key: "objective" },
  { label: "when to use", key: "objective" },
  { label: "goal", key: "user_goal" },
  { label: "success criteria", key: "desired_outcomes" },
  { label: "definition of done", key: "desired_outcomes" },
  { label: "context", key: "strategic_context" },
  { label: "background", key: "strategic_context" },
  { label: "requirements", key: "constraints" },
  { label: "important constraints", key: "constraints" },
  { label: "error handling", key: "edge_cases" },
  { label: "exceptions", key: "edge_cases" },
  { label: "completion", key: "stop_rules_verification" },
  { label: "exit criteria", key: "stop_rules_verification" },
  { label: "validation", key: "stop_rules_verification" },
];

function aliasHeadingPattern(label: string): RegExp {
  const escaped = label
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`^#{1,6}\\s+${escaped}\\b`, "i");
}

/**
 * Match order matters: canonical entries first so canonical spellings always win
 * (first-match-wins in parseMarkdownSections), then aliases catch the headings the
 * canonical patterns miss. `alias: true` rows record the literal heading they
 * matched on `ParsedSection.sourceHeading` for legibility.
 */
const HEADING_MATCHERS: Array<{ pattern: RegExp; key: SectionKey; alias: boolean }> = [
  ...MARKDOWN_HEADING_MAP.map((m) => ({ ...m, alias: false })),
  ...SECTION_ALIASES.map((a) => ({
    pattern: aliasHeadingPattern(a.label),
    key: a.key,
    alias: true,
  })),
];

const YAML_KEY_MAP: Record<string, SectionKey> = {
  objective: "objective",
  user_goal: "user_goal",
  desired_outcomes: "desired_outcomes",
  health_metrics: "health_metrics",
  strategic_context: "strategic_context",
  steering_constraints: "constraints",
  hard_constraints: "constraints",
  decision_authority: "decision_authority",
  edge_cases: "edge_cases",
  stop_rules: "stop_rules_verification",
  verification: "stop_rules_verification",
};

const PLACEHOLDER_LINE = /^\s*["']?\[[A-Z][A-Z0-9_\s\-/.]+\]["']?\s*$/;

function emptySections(): Record<SectionKey, ParsedSection> {
  const out = {} as Record<SectionKey, ParsedSection>;
  for (const k of SECTION_KEYS) {
    out[k] = { present: false, empty: true, raw: "", items: [] };
  }
  return out;
}

function isPlaceholderOnly(text: string, items: string[]): boolean {
  const stripped = text.trim();
  if (!stripped && items.length === 0) return true;
  const allPlaceholders = (input: string): boolean =>
    input
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .every((l) => PLACEHOLDER_LINE.test(l));
  if (items.length > 0) {
    return items.every((it) => PLACEHOLDER_LINE.test(it.trim()));
  }
  return allPlaceholders(stripped);
}

function detectAutonomous(text: string): boolean {
  return /\b(launchd|cron(tab)?|scheduled\s+(at|via|every|on|task|run)|fully\s+autonomous|autonomous\s+(agent|skill|run|loop|mode|operation|execution|workflow|trigger)|run\s+autonomously|background\s+(agent|process|worker|daemon|service)|while\s+true|while\s+1|polling\s+(loop|interval)|infinite\s+loop|every\s+\d+\s+(minutes?|hours?|days?|seconds?)|6:00\s*am|zero[\s-]?interaction\s+mandate)\b/i.test(
    text,
  );
}

function extractFrontmatter(text: string): { frontmatter: string | null; body: string } {
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") return { frontmatter: null, body: text };
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      return {
        frontmatter: lines.slice(1, i).join("\n"),
        body: lines.slice(i + 1).join("\n"),
      };
    }
  }
  return { frontmatter: null, body: text };
}

function parseYamlBlock(yaml: string): Record<string, { body: string; items: string[] }> {
  const out: Record<string, { body: string; items: string[] }> = {};
  const lines = yaml.split("\n");
  let currentKey: string | null = null;
  let currentBody: string[] = [];
  let currentItems: string[] = [];
  let pendingItem: string[] = [];
  let inList = false;

  const flushItem = () => {
    if (pendingItem.length) {
      currentItems.push(pendingItem.join("\n").trim());
      pendingItem = [];
    }
  };
  const flushKey = () => {
    if (currentKey) {
      flushItem();
      out[currentKey] = { body: currentBody.join("\n").trim(), items: currentItems };
    }
    currentKey = null;
    currentBody = [];
    currentItems = [];
    inList = false;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
    const topLevelMatch = line.match(/^([a-z_][a-z0-9_]*)\s*:\s*(.*)$/i);
    if (topLevelMatch && !/^[ \t]/.test(line)) {
      flushKey();
      currentKey = topLevelMatch[1] ?? null;
      const inlineValue = (topLevelMatch[2] ?? "").trim();
      if (inlineValue && !inlineValue.startsWith(">") && !inlineValue.startsWith("|")) {
        currentBody.push(inlineValue);
      }
      continue;
    }
    if (!currentKey) continue;
    const listItemMatch = line.match(/^(\s+)?-\s+(.*)$/);
    if (listItemMatch) {
      flushItem();
      pendingItem.push((listItemMatch[2] ?? "").trim());
      inList = true;
      currentBody.push(line);
      continue;
    }
    if (inList && /^\s+\S/.test(line)) {
      pendingItem.push(line.trim());
      currentBody.push(line);
      continue;
    }
    if (line.trim() === "" || /^\s+\S/.test(line)) {
      currentBody.push(line);
      continue;
    }
  }
  flushKey();
  return out;
}

function extractMarkdownListItems(text: string): string[] {
  const items: string[] = [];
  const lines = text.split("\n");
  let pending: string[] = [];
  const flush = () => {
    if (pending.length) {
      const joined = pending.join("\n").trim();
      if (joined) items.push(joined);
      pending = [];
    }
  };
  for (const line of lines) {
    const m = line.match(/^\s*[-*+]\s+(.*)$/);
    if (m) {
      flush();
      pending = [m[1] ?? ""];
    } else if (pending.length && /^\s+\S/.test(line)) {
      pending.push(line.trim());
    } else if (pending.length && line.trim() === "") {
      // blank line continues current item
    } else if (pending.length) {
      flush();
    }
  }
  flush();
  return items;
}

function parseMarkdownSections(
  body: string,
): Partial<Record<SectionKey, { raw: string; items: string[]; sourceHeading?: string }>> {
  const out: Partial<
    Record<SectionKey, { raw: string; items: string[]; sourceHeading?: string }>
  > = {};
  const lines = body.split("\n");
  type Block = { key: SectionKey; lines: string[]; sourceHeading?: string };
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
    let matched: SectionKey | null = null;
    let matchedViaAlias = false;
    for (const { pattern, key, alias } of HEADING_MATCHERS) {
      if (pattern.test(line)) {
        matched = key;
        matchedViaAlias = alias;
        break;
      }
    }
    if (matched) {
      if (current) blocks.push(current);
      current = {
        key: matched,
        lines: [],
        sourceHeading: matchedViaAlias ? line.trim() : undefined,
      };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) blocks.push(current);

  for (const block of blocks) {
    const text = block.lines.join("\n").trim();
    const items = extractMarkdownListItems(text);
    const prev = out[block.key];
    if (prev) {
      out[block.key] = {
        raw: prev.raw + "\n\n" + text,
        items: [...prev.items, ...items],
        // Keep the first alias heading that produced this section, if any.
        sourceHeading: prev.sourceHeading ?? block.sourceHeading,
      };
    } else {
      out[block.key] = { raw: text, items, sourceHeading: block.sourceHeading };
    }
  }
  return out;
}

export function parseIntentSpec(text: string): ParsedSpec {
  const { frontmatter, body } = extractFrontmatter(text);
  const sections = emptySections();
  let format: ParsedSpec["format"] = "markdown";

  if (frontmatter !== null) {
    format = "yaml-frontmatter";
    const yaml = parseYamlBlock(frontmatter);
    for (const [yamlKey, parsed] of Object.entries(yaml)) {
      const sectionKey = YAML_KEY_MAP[yamlKey];
      if (!sectionKey) continue;
      const existing = sections[sectionKey];
      const mergedRaw = existing.present
        ? `${existing.raw}\n\n${parsed.body}`.trim()
        : parsed.body.trim();
      const mergedItems = [...existing.items, ...parsed.items];
      sections[sectionKey] = {
        present: true,
        empty: isPlaceholderOnly(mergedRaw, mergedItems),
        raw: mergedRaw,
        items: mergedItems,
      };
    }
  }

  const md = parseMarkdownSections(body);
  for (const key of Object.keys(md) as SectionKey[]) {
    const parsed = md[key]!;
    const existing = sections[key];
    if (existing.present) continue;
    sections[key] = {
      present: true,
      empty: isPlaceholderOnly(parsed.raw, parsed.items),
      raw: parsed.raw,
      items: parsed.items,
      sourceHeading: parsed.sourceHeading,
    };
    if (frontmatter !== null) format = "mixed";
  }

  return { format, raw: text, sections, autonomous: detectAutonomous(text) };
}
