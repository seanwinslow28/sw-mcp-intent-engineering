import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { AuditIntentSpecInputSchema } from "./audit.js";
import { AssessRetrofitLevelInputSchema } from "./retrofit.js";
import { GenerateIntentSpecScaffoldInputSchema } from "./scaffold.js";

const longSpec = "x".repeat(120); // clears min(50) / min(100) bounds

test("audit: valid spec_text-only input parses", () => {
  const parsed = AuditIntentSpecInputSchema.parse({ spec_text: longSpec });
  assert.equal(parsed.spec_text, longSpec);
});

test("audit: .strict() rejects an unexpected extra key (ZodError)", () => {
  assert.throws(
    () => AuditIntentSpecInputSchema.parse({ spec_text: longSpec, sneaky: true }),
    z.ZodError,
  );
});

test("audit: one-of refine rejects BOTH spec_text and file_path", () => {
  assert.throws(
    () =>
      AuditIntentSpecInputSchema.parse({
        spec_text: longSpec,
        file_path: "/tmp/spec.md",
      }),
    z.ZodError,
  );
});

test("audit: one-of refine rejects NEITHER spec_text nor file_path", () => {
  assert.throws(() => AuditIntentSpecInputSchema.parse({}), z.ZodError);
});

test("retrofit: valid skill_text-only input parses", () => {
  const parsed = AssessRetrofitLevelInputSchema.parse({ skill_text: longSpec });
  assert.equal(parsed.skill_text, longSpec);
});

test("retrofit: .strict() rejects an unexpected extra key (ZodError)", () => {
  assert.throws(
    () =>
      AssessRetrofitLevelInputSchema.parse({ skill_text: longSpec, evil: 1 }),
    z.ZodError,
  );
});

test("retrofit: one-of refine rejects BOTH skill_text and file_path", () => {
  assert.throws(
    () =>
      AssessRetrofitLevelInputSchema.parse({
        skill_text: longSpec,
        file_path: "/tmp/skill.md",
      }),
    z.ZodError,
  );
});

test("retrofit: one-of refine rejects NEITHER skill_text nor file_path", () => {
  assert.throws(() => AssessRetrofitLevelInputSchema.parse({}), z.ZodError);
});

test("scaffold: empty object parses (all fields optional)", () => {
  const parsed = GenerateIntentSpecScaffoldInputSchema.parse({});
  assert.equal(parsed.kind, undefined);
});

test("scaffold: .strict() rejects an unexpected extra key (ZodError)", () => {
  assert.throws(
    () =>
      GenerateIntentSpecScaffoldInputSchema.parse({
        kind: "blank",
        injected: "payload",
      }),
    z.ZodError,
  );
});
